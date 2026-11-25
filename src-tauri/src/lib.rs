use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindow, WindowEvent};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use url::Url;

const DEFAULT_SHORTCUT: &str = "End";
const POPUP_LOGICAL_WIDTH: f64 = 420.0;
const POPUP_LOGICAL_HEIGHT: f64 = 620.0;
const POPUP_MARGIN_LOGICAL: f64 = 14.0;
const BLUR_GRACE_MS: u128 = 240;
const MAX_FETCH_BYTES: usize = 2 * 1024 * 1024;
const GITHUB_RELEASES_PREFIX: &str = "/repos/eval19/athar/releases";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedDesktopConfig {
    shortcut: String,
    shortcut_enabled: bool,
    pinned: bool,
}

impl Default for PersistedDesktopConfig {
    fn default() -> Self {
        Self {
            shortcut: DEFAULT_SHORTCUT.to_string(),
            shortcut_enabled: true,
            pinned: false,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopStateDto {
    shortcut: String,
    shortcut_enabled: bool,
    pinned: bool,
    autostart: bool,
}

struct TrayHandles {
    pin_item: CheckMenuItem<tauri::Wry>,
    shortcut_item: CheckMenuItem<tauri::Wry>,
    autostart_item: CheckMenuItem<tauri::Wry>,
}

struct DesktopState {
    config: Mutex<PersistedDesktopConfig>,
    last_shown_at: Mutex<Option<Instant>>,
    tray: Mutex<Option<TrayHandles>>,
    http: reqwest::Client,
}

impl DesktopState {
    fn new(config: PersistedDesktopConfig) -> Self {
        let http = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(12))
            .timeout(Duration::from_secs(15))
            .user_agent(concat!("Athar-Desktop/", env!("CARGO_PKG_VERSION")))
            .build()
            .expect("failed to build HTTPS client");

        Self {
            config: Mutex::new(config),
            last_shown_at: Mutex::new(None),
            tray: Mutex::new(None),
            http,
        }
    }
}

fn config_file_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join("desktop-settings.json"))
}

fn load_persisted_config(app: &AppHandle) -> PersistedDesktopConfig {
    let Some(path) = config_file_path(app) else {
        return PersistedDesktopConfig::default();
    };
    let Ok(raw) = fs::read_to_string(&path) else {
        return PersistedDesktopConfig::default();
    };
    let mut cfg: PersistedDesktopConfig =
        serde_json::from_str(&raw).unwrap_or_else(|_| PersistedDesktopConfig::default());
    if cfg.shortcut.trim().is_empty() || cfg.shortcut.parse::<Shortcut>().is_err() {
        cfg.shortcut = DEFAULT_SHORTCUT.to_string();
    }
    cfg
}

fn save_persisted_config(app: &AppHandle, cfg: &PersistedDesktopConfig) {
    let Some(path) = config_file_path(app) else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(cfg) {
        let _ = fs::write(path, json);
    }
}

fn is_allowed_desktop_url(raw: &str) -> Result<Url, String> {
    let parsed = Url::parse(raw).map_err(|_| "Blocked invalid outbound URL".to_string())?;
    if parsed.scheme() != "https" {
        return Err("Blocked non-HTTPS outbound URL".to_string());
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("Blocked credentialed outbound URL".to_string());
    }
    let host = parsed.host_str().unwrap_or("");
    let allowed = match host {
        "dorar.net" | "www.dorar.net" => true,
        "api.github.com" => parsed.path().starts_with(GITHUB_RELEASES_PREFIX),
        _ => false,
    };
    if !allowed {
        return Err("Blocked disallowed outbound host".to_string());
    }
    Ok(parsed)
}

fn position_bottom_right(window: &WebviewWindow) {
    let target_monitor = window
        .cursor_position()
        .ok()
        .and_then(|cursor| {
            window.available_monitors().ok().and_then(|monitors| {
                monitors.into_iter().find(|m| {
                    let pos = m.position();
                    let size = m.size();
                    let cx = cursor.x;
                    let cy = cursor.y;
                    cx >= pos.x as f64
                        && cx < (pos.x as f64 + size.width as f64)
                        && cy >= pos.y as f64
                        && cy < (pos.y as f64 + size.height as f64)
                })
            })
        })
        .or_else(|| window.primary_monitor().ok().flatten())
        .or_else(|| window.current_monitor().ok().flatten());

    let Some(monitor) = target_monitor else {
        return;
    };

    let scale = monitor.scale_factor();
    let work = monitor.work_area();
    let margin = (POPUP_MARGIN_LOGICAL * scale).round() as i32;
    let desired_w = (POPUP_LOGICAL_WIDTH * scale).round() as u32;
    let desired_h = (POPUP_LOGICAL_HEIGHT * scale).round() as u32;

    let max_w = work.size.width.saturating_sub((margin * 2) as u32).max(320);
    let max_h = work.size.height.saturating_sub((margin * 2) as u32).max(400);
    let w = desired_w.min(max_w);
    let h = desired_h.min(max_h);

    let x = work.position.x + (work.size.width as i32) - (w as i32) - margin;
    let y = work.position.y + (work.size.height as i32) - (h as i32) - margin;

    let _ = window.set_size(PhysicalSize::new(w, h));
    let _ = window.set_position(PhysicalPosition::new(x, y));
}

fn show_popup(app: &AppHandle, reposition: bool) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if reposition {
        position_bottom_right(&window);
    }
    if let Ok(mut last) = app.state::<DesktopState>().last_shown_at.lock() {
        *last = Some(Instant::now());
    }
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
    let _ = window.emit("athar:focus-search", ());
}

fn hide_popup(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

fn toggle_popup(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let visible = window.is_visible().unwrap_or(false);
    let focused = window.is_focused().unwrap_or(false);
    if visible && focused {
        hide_popup(app);
    } else {
        show_popup(app, !visible);
    }
}

fn build_state_dto(app: &AppHandle) -> DesktopStateDto {
    let cfg = app
        .state::<DesktopState>()
        .config
        .lock()
        .map(|g| g.clone())
        .unwrap_or_default();
    let autostart = app.autolaunch().is_enabled().unwrap_or(false);
    DesktopStateDto {
        shortcut: cfg.shortcut,
        shortcut_enabled: cfg.shortcut_enabled,
        pinned: cfg.pinned,
        autostart,
    }
}

fn sync_tray_and_emit(app: &AppHandle) {
    let dto = build_state_dto(app);
    if let Ok(guard) = app.state::<DesktopState>().tray.lock() {
        if let Some(handles) = guard.as_ref() {
            let _ = handles.pin_item.set_checked(dto.pinned);
            let _ = handles.shortcut_item.set_checked(dto.shortcut_enabled);
            let _ = handles
                .shortcut_item
                .set_text(format!("Global Shortcut ({})", dto.shortcut));
            let _ = handles.autostart_item.set_checked(dto.autostart);
        }
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("athar:desktop-state", &dto);
    }
}

fn apply_global_shortcut(app: &AppHandle, shortcut_str: &str, enabled: bool) -> Result<(), String> {
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();
    if !enabled {
        return Ok(());
    }
    let parsed: Shortcut = shortcut_str
        .parse()
        .map_err(|_| format!("Invalid shortcut: {shortcut_str}"))?;
    gs.on_shortcut(parsed, move |app_handle, _shortcut, event| {
        if event.state() == ShortcutState::Pressed {
            toggle_popup(app_handle);
        }
    })
    .map_err(|err| format!("Failed to register shortcut '{shortcut_str}': {err}"))?;
    Ok(())
}

#[tauri::command]
async fn desktop_fetch(
    state: tauri::State<'_, DesktopState>,
    url: String,
    accept: Option<String>,
    max_bytes: Option<usize>,
) -> Result<String, String> {
    let parsed = is_allowed_desktop_url(&url)?;
    let limit = max_bytes.unwrap_or(MAX_FETCH_BYTES).min(MAX_FETCH_BYTES);

    let mut req = state.http.get(parsed);
    if let Some(accept_hdr) = accept {
        req = req.header(reqwest::header::ACCEPT, accept_hdr);
    } else {
        req = req.header(
            reqwest::header::ACCEPT,
            "text/html, application/json, text/plain, */*",
        );
    }

    let resp = req
        .send()
        .await
        .map_err(|err| format!("Network request failed: {err}"))?;

    // Re-verify final destination after any redirects
    is_allowed_desktop_url(resp.url().as_str())?;

    let status = resp.status();
    if !status.is_success() {
        return Err(format!("Upstream HTTP error ({})", status.as_u16()));
    }

    if let Some(len) = resp.content_length() {
        if len as usize > limit {
            return Err("Response exceeded safety limit".to_string());
        }
    }

    let bytes = resp
        .bytes()
        .await
        .map_err(|err| format!("Failed reading response body: {err}"))?;
    if bytes.len() > limit {
        return Err("Response exceeded safety limit".to_string());
    }

    String::from_utf8(bytes.to_vec()).map_err(|_| "Response was not valid UTF-8".to_string())
}

#[tauri::command]
fn get_desktop_state(app: AppHandle) -> DesktopStateDto {
    build_state_dto(&app)
}

#[tauri::command]
fn hide_window(app: AppHandle) {
    hide_popup(&app);
}

#[tauri::command]
fn set_pinned(app: AppHandle, pinned: bool) -> DesktopStateDto {
    {
        let state = app.state::<DesktopState>();
        if let Ok(mut cfg) = state.config.lock() {
            cfg.pinned = pinned;
            save_persisted_config(&app, &cfg);
        };
    }
    sync_tray_and_emit(&app);
    build_state_dto(&app)
}

#[tauri::command]
fn set_shortcut(app: AppHandle, shortcut: String, enabled: bool) -> Result<DesktopStateDto, String> {
    let trimmed = shortcut.trim().to_string();
    if trimmed.is_empty() {
        return Err("Shortcut cannot be empty".to_string());
    }
    let previous = app
        .state::<DesktopState>()
        .config
        .lock()
        .map(|g| g.clone())
        .unwrap_or_default();

    if let Err(err) = apply_global_shortcut(&app, &trimmed, enabled) {
        // Restore previous shortcut if registration fails
        let _ = apply_global_shortcut(&app, &previous.shortcut, previous.shortcut_enabled);
        return Err(err);
    }

    {
        let state = app.state::<DesktopState>();
        if let Ok(mut cfg) = state.config.lock() {
            cfg.shortcut = trimmed;
            cfg.shortcut_enabled = enabled;
            save_persisted_config(&app, &cfg);
        };
    }
    sync_tray_and_emit(&app);
    Ok(build_state_dto(&app))
}

#[tauri::command]
fn set_autostart(app: AppHandle, enabled: bool) -> Result<DesktopStateDto, String> {
    let launcher = app.autolaunch();
    if enabled {
        launcher
            .enable()
            .map_err(|err| format!("Failed enabling autostart: {err}"))?;
    } else {
        launcher
            .disable()
            .map_err(|err| format!("Failed disabling autostart: {err}"))?;
    }
    sync_tray_and_emit(&app);
    Ok(build_state_dto(&app))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_popup(app, true);
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let handle = app.handle().clone();
            let persisted = load_persisted_config(&handle);
            let initial_shortcut = persisted.shortcut.clone();
            let initial_enabled = persisted.shortcut_enabled;
            let initial_pinned = persisted.pinned;
            let initial_autostart = handle.autolaunch().is_enabled().unwrap_or(false);

            app.manage(DesktopState::new(persisted));

            // Register saved/default global shortcut (End)
            let _ = apply_global_shortcut(&handle, &initial_shortcut, initial_enabled);

            // Build system tray menu
            let toggle_item = MenuItem::with_id(app, "toggle", "Show / Hide Athar", true, None::<&str>)?;
            let pin_item = CheckMenuItem::with_id(app, "pin", "Pin Window", true, initial_pinned, None::<&str>)?;
            let shortcut_item = CheckMenuItem::with_id(
                app,
                "shortcut",
                format!("Global Shortcut ({initial_shortcut})"),
                true,
                initial_enabled,
                None::<&str>,
            )?;
            let autostart_item = CheckMenuItem::with_id(
                app,
                "autostart",
                "Launch at Windows Startup",
                true,
                initial_autostart,
                None::<&str>,
            )?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Athar", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[
                    &toggle_item,
                    &pin_item,
                    &shortcut_item,
                    &autostart_item,
                    &sep,
                    &quit_item,
                ],
            )?;

            if let Ok(mut tray_guard) = app.state::<DesktopState>().tray.lock() {
                *tray_guard = Some(TrayHandles {
                    pin_item,
                    shortcut_item,
                    autostart_item,
                });
            }

            let mut tray_builder = TrayIconBuilder::with_id("athar-tray")
                .tooltip("Athar (أَثَر) — Press End to search")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app_handle, event| match event.id.as_ref() {
                    "toggle" => toggle_popup(app_handle),
                    "pin" => {
                        let next = {
                            let state = app_handle.state::<DesktopState>();
                            let next_val = !state
                                .config
                                .lock()
                                .map(|g| g.pinned)
                                .unwrap_or(false);
                            if let Ok(mut cfg) = state.config.lock() {
                                cfg.pinned = next_val;
                                save_persisted_config(app_handle, &cfg);
                            }
                            next_val
                        };
                        let _ = next;
                        sync_tray_and_emit(app_handle);
                    }
                    "shortcut" => {
                        let (shortcut_str, next_enabled) = {
                            let state = app_handle.state::<DesktopState>();
                            let guard = state.config.lock().map(|g| g.clone()).unwrap_or_default();
                            (guard.shortcut, !guard.shortcut_enabled)
                        };
                        if apply_global_shortcut(app_handle, &shortcut_str, next_enabled).is_ok() {
                            if let Ok(mut cfg) = app_handle.state::<DesktopState>().config.lock() {
                                cfg.shortcut_enabled = next_enabled;
                                save_persisted_config(app_handle, &cfg);
                            }
                        }
                        sync_tray_and_emit(app_handle);
                    }
                    "autostart" => {
                        let launcher = app_handle.autolaunch();
                        let current = launcher.is_enabled().unwrap_or(false);
                        let _ = if current {
                            launcher.disable()
                        } else {
                            launcher.enable()
                        };
                        sync_tray_and_emit(app_handle);
                    }
                    "quit" => {
                        app_handle.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_popup(tray.app_handle());
                    }
                });

            if let Some(icon) = app.default_window_icon().cloned() {
                tray_builder = tray_builder.icon(icon);
            }
            tray_builder.build(app)?;

            // Show the popup once on launch snapped cleanly to the bottom-right corner
            show_popup(&handle, true);
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window.hide();
            }
            WindowEvent::Focused(false) => {
                let app = window.app_handle();
                let state = app.state::<DesktopState>();
                let pinned = state.config.lock().map(|g| g.pinned).unwrap_or(false);
                if pinned {
                    return;
                }
                let within_grace = state
                    .last_shown_at
                    .lock()
                    .ok()
                    .and_then(|g| *g)
                    .map(|t| t.elapsed().as_millis() < BLUR_GRACE_MS)
                    .unwrap_or(false);
                if !within_grace {
                    let _ = window.hide();
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            desktop_fetch,
            get_desktop_state,
            hide_window,
            set_pinned,
            set_shortcut,
            set_autostart,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Athar desktop application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allowlist_permits_dorar_and_github_releases_only() {
        assert!(is_allowed_desktop_url("https://dorar.net/hadith/search?q=test").is_ok());
        assert!(is_allowed_desktop_url("https://www.dorar.net/h/abc/osoul").is_ok());
        assert!(is_allowed_desktop_url("https://api.github.com/repos/eval19/athar/releases/latest").is_ok());

        assert!(is_allowed_desktop_url("http://dorar.net/hadith/search?q=test").is_err());
        assert!(is_allowed_desktop_url("https://evil.example/dorar.net").is_err());
        assert!(is_allowed_desktop_url("https://api.github.com/repos/other/repo/releases").is_err());
        assert!(is_allowed_desktop_url("https://user:pass@dorar.net/").is_err());
    }
}
