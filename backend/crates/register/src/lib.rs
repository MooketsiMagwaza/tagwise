//! Tagwise register service: workspaces and roles, sites, tagged assets and
//! their custody, stock lines with idempotent movements, stock-takes,
//! comments and the activity log.
#![allow(dead_code)]

pub mod clients;
pub mod config;
pub mod controllers;
pub mod domain;
pub mod openapi;
pub mod repository;
pub mod routes;
pub mod schemas;
pub mod state;
