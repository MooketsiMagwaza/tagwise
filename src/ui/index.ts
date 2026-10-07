// The component library. Screens import from here for anything visual:
// every look (and every token it reads) lives inside one of these
// components, so restyling is a change to one folder.
//
// Adding a component: a folder here with `Name.tsx` + `Name.module.css`,
// styled only with theme tokens (`var(--color-…)`, `var(--space-…)`), then
// one export line below.

export { Avatar } from './Avatar/Avatar';
export { Banner } from './Banner/Banner';
export { Barcode } from './Barcode/Barcode';
export { Button, ButtonLink, IconButton, type ButtonSize, type ButtonVariant } from './Button/Button';
export { Callout } from './Callout/Callout';
export { Card, CardHeader } from './Card/Card';
export { Clickable } from './Clickable/Clickable';
export { CommandPalette, type Command, type CommandGroup } from './CommandPalette/CommandPalette';
export { ConfirmDialog } from './ConfirmDialog/ConfirmDialog';
export { Divider } from './Divider/Divider';
export { EmptyState } from './EmptyState/EmptyState';
export { Input, SearchField, SelectField, TextAreaField, TextField } from './Field/Field';
export { IconBadge, type BadgeTone } from './IconBadge/IconBadge';
export { toneForKey } from './IconBadge/tone';
export { InfoTip } from './InfoTip/InfoTip';
export { Grid, Form, Row, Stack, View, type Gap } from './Layout/Layout';
export { List, ListItem } from './List/List';
export { Modal } from './Modal/Modal';
export { Page, PageHeader } from './Page/Page';
export { Pill, type PillTone } from './Pill/Pill';
export { PrintPortal, printNow, type Paper } from './PrintPortal/PrintPortal';
export { QrCode } from './QrCode/QrCode';
export { RadioList, type RadioOption } from './RadioList/RadioList';
export { MenuItem, Popover, PopoverDivider, PopoverHeader } from './Popover/Popover';
export { Segmented } from './Segmented/Segmented';
export { CardSkeleton, SkeletonLines } from './Skeleton/Skeleton';
export { Sparkline } from './Sparkline/Sparkline';
export { Switch } from './Switch/Switch';
export { Steps, type Step } from './Steps/Steps';
export { Table, Td, Th } from './Table/Table';
export { Text, type TextTone, type TextVariant } from './Text/Text';
export { ToastStack, type ToastItem } from './Toast/Toast';
export { VisuallyHidden } from './VisuallyHidden/VisuallyHidden';
