// Reads QR codes and barcodes three ways, because no single one works
// everywhere:
// 1. the camera, decoded by the browser's BarcodeDetector where it exists
//    (Chrome and Edge on Android, Samsung Internet), else by ZXing running in
//    the page (Safari, Firefox, desktop Chrome on Windows and Linux);
// 2. typing the code;
// 3. a USB or Bluetooth scanner, which types the code and presses Enter.
// Started from the owner's earlier scanner component; the ZXing fallback,
// continuous scanning, torch and the engine label are new.

import { useEffect, useRef, useState } from 'react';
import { Flashlight, Keyboard, Video } from 'lucide-react';
import { Button, Form, IconButton, Row, Segmented, TextField } from '../../ui';
import styles from './Scanner.module.css';

type Mode = 'camera' | 'manual';
type CameraState = 'starting' | 'scanning' | 'denied' | 'unavailable' | 'insecure';
export type Engine = 'native' | 'zxing' | null;

interface Detector {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
}
type DetectorCtor = { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> };

const WANTED = ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'];

async function nativeDetector(): Promise<Detector | null> {
  const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const supported = (await Ctor.getSupportedFormats?.()) ?? WANTED;
    const formats = WANTED.filter((f) => supported.includes(f));
    return formats.length ? new Ctor({ formats }) : null;
  } catch {
    return null;
  }
}

/** A ZXing decoder over a canvas, loaded only when the browser has no detector. */
async function zxingDecoder() {
  const Z = await import('@zxing/library');
  const hints = new Map();
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [
    Z.BarcodeFormat.QR_CODE,
    Z.BarcodeFormat.EAN_13,
    Z.BarcodeFormat.EAN_8,
    Z.BarcodeFormat.CODE_128,
    Z.BarcodeFormat.CODE_39,
    Z.BarcodeFormat.UPC_A,
  ]);
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  const reader = new Z.MultiFormatReader();
  reader.setHints(hints);
  return (canvas: HTMLCanvasElement): string | null => {
    try {
      const source = new Z.HTMLCanvasElementLuminanceSource(canvas);
      return reader.decode(new Z.BinaryBitmap(new Z.HybridBinarizer(source))).getText();
    } catch {
      return null; // NotFoundException on most frames: nothing in view yet
    } finally {
      reader.reset();
    }
  };
}

export function Scanner({ onScan, hint, paused = false }: { onScan: (value: string) => void; hint?: string; paused?: boolean }) {
  const [mode, setMode] = useState<Mode>('camera');
  const [camera, setCamera] = useState<CameraState>('starting');
  const [engine, setEngine] = useState<Engine>(null);
  const [torch, setTorch] = useState<{ available: boolean; on: boolean }>({ available: false, on: false });
  const [typed, setTyped] = useState('');
  const [flash, setFlash] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    if (mode !== 'camera') return;
    let stopped = false;
    let frame = 0;
    let stream: MediaStream | null = null;
    setCamera('starting');

    (async () => {
      if (!window.isSecureContext) {
        setCamera('insecure');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera('unavailable');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      } catch (e) {
        setCamera((e as DOMException)?.name === 'NotAllowedError' ? 'denied' : 'unavailable');
        return;
      }
      if (stopped || !video.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const el = video.current;
      el.srcObject = stream;
      await el.play().catch(() => {});
      track.current = stream.getVideoTracks()[0] ?? null;
      const caps = (track.current?.getCapabilities?.() ?? {}) as { torch?: boolean };
      setTorch({ available: !!caps.torch, on: false });
      setCamera('scanning');

      const detector = await nativeDetector();
      const decode = detector ? null : await zxingDecoder();
      setEngine(detector ? 'native' : 'zxing');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      let last = 0;
      let lastValue = '';
      let lastAt = 0;

      const tick = async (now: number) => {
        if (stopped) return;
        frame = requestAnimationFrame(tick);
        if (pausedRef.current || now - last < (detector ? 120 : 220) || el.readyState < 2 || !el.videoWidth) return;
        last = now;
        let value: string | null = null;
        if (detector) {
          try {
            value = (await detector.detect(el))[0]?.rawValue ?? null;
          } catch {
            value = null;
          }
        } else if (decode) {
          const w = Math.min(el.videoWidth, 720);
          canvas.width = w;
          canvas.height = Math.round((el.videoHeight * w) / el.videoWidth);
          ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
          value = decode(canvas);
        }
        // Continuous: the same code is ignored for 2.5 s so one label reads once.
        if (value && !stopped && (value !== lastValue || now - lastAt > 2500)) {
          lastValue = value;
          lastAt = now;
          setFlash(true);
          window.setTimeout(() => setFlash(false), 220);
          navigator.vibrate?.(40);
          onScanRef.current(value);
        }
      };
      frame = requestAnimationFrame(tick);
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
      track.current = null;
    };
  }, [mode]);

  async function toggleTorch() {
    const t = track.current;
    if (!t) return;
    const on = !torch.on;
    try {
      await t.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      setTorch({ available: true, on });
    } catch {
      setTorch({ available: false, on: false });
    }
  }

  const status: Record<CameraState, string> = {
    starting: 'Starting the camera…',
    scanning: hint ?? 'Point the camera at a QR label or a barcode. It reads by itself.',
    denied: 'Camera access is blocked. Allow it in the browser’s site settings, or type the code instead.',
    unavailable: 'No camera is available here. Type the code, or use a handheld scanner.',
    insecure: 'The camera needs a secure (https) page. Type the code instead.',
  };

  return (
    <div className={styles.scanner}>
      <Segmented<Mode>
        label="How to scan"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'camera', label: <span className={styles.opt}><Video size={14} /> Camera</span> },
          { value: 'manual', label: <span className={styles.opt}><Keyboard size={14} /> Type or handheld scanner</span> },
        ]}
      />

      {mode === 'camera' ? (
        <>
          <div className={`${styles.viewport} ${flash ? styles.flash : ''}`}>
            <video ref={video} className={styles.video} muted playsInline />
            <span className={styles.frame} aria-hidden="true" />
            {camera !== 'scanning' && <span className={styles.overlay}>{status[camera]}</span>}
            {torch.available && (
              <span className={styles.torch}>
                <IconButton label={torch.on ? 'Turn the torch off' : 'Turn the torch on'} variant="overlay" aria-pressed={torch.on} onClick={toggleTorch}>
                  <Flashlight size={16} />
                </IconButton>
              </span>
            )}
          </div>
          <p className={styles.status} role="status">
            {camera === 'scanning' ? status.scanning : ''}
            {camera === 'scanning' && engine && (
              <span className={styles.engine}>{engine === 'native' ? 'Decoding with the browser’s barcode detector' : 'Decoding with ZXing in the page (this browser has no barcode detector)'}</span>
            )}
          </p>
        </>
      ) : (
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            const value = typed.trim();
            if (value) {
              onScanRef.current(value);
              setTyped('');
            }
          }}
        >
          <TextField
            label="Tag, SKU or barcode"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            hint="A handheld scanner types the code and presses Enter for you."
          />
          <Row justify="end">
            <Button type="submit" disabled={!typed.trim()}>
              Look it up
            </Button>
          </Row>
        </Form>
      )}
    </div>
  );
}
