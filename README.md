<div align="center">
<img src="/data/icons/hicolor/scalable/apps/com.vixalien.sticky.svg" height="64">

# Sticky Notes

[![Please do not theme this app](https://stopthemingmy.app/badge.svg)](https://stopthemingmy.app) 

Sticky Notes is a simple note taking application for the GNOME desktop. It is
written in GJS and uses GTK4.

![All notes](data/resources/screenshots/notes.png)
![Note](data/resources/screenshots/note.png)

</div>

## Tray icon

Sticky Notes provides a tray icon with quick access to all your notes. It uses
the freedesktop [StatusNotifierItem][spec] specification, which KDE Plasma and
most other desktop environments support out of the box. GNOME Shell does not:
to see the tray icon on GNOME, install and enable the
[AppIndicator and KStatusNotifierItem Support][extension] extension.
Without it, the app still works normally — the tray icon just won't be shown.

[spec]: https://www.freedesktop.org/wiki/Specifications/StatusNotifierItem/
[extension]: https://extensions.gnome.org/extension/615/appindicator-support/

## Installation

### From Flathub

Sticky Notes is available to download on
[Flathub](https://flathub.org/apps/details/com.vixalien.sticky).

<a href="https://flathub.org/apps/details/com.vixalien.sticky" title="Download on Flathub">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://flathub.org/api/badge?locale=en&light">
    <source media="(prefers-color-scheme: light)" srcset="https://flathub.org/api/badge?locale=en">
    <img alt="Download Sticky Notes on Flathub" src="https://flathub.org/api/badge?locale=en">
  </picture>
</a>

### From source

To install from source, you need `nodejs` and `yarn` installed. Then, you need
to clone the repository by being careful to also pull in the submodules:

```sh
git clone https://github.com/vixalien/sticky.git --recurse-submodules
```

Open the project in GNOME Builder and click "Run Project".

> Note: Other non-Flatpak environments are no longer supported. This is because
Sticky Notes uses an upcoming version of libadwaita.
