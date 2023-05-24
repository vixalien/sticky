<div align="center">
<img src="/data/icons/hicolor/scalable/apps/com.vixalien.sticky.svg" height="64">

# Sticky Notes

[![Please do not theme this app](https://stopthemingmy.app/badge.svg)](https://stopthemingmy.app) 

Sticky Notes is a simple note taking application for the GNOME desktop. It is
written in GJS and uses GTK4.

![All notes](data/resources/screenshots/notes.png)
![Note](data/resources/screenshots/note.png)

</div>

## Installation

### From Flathub

Sticky Notes is available to download on
[Flathub](https://flathub.org/apps/details/com.vixalien.sticky).

<a href="https://flathub.org/apps/details/com.vixalien.sticky" title="Download on Flathub">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="data/resources/flathub-badges/download-i.svg">
    <source media="(prefers-color-scheme: light)" srcset="data/resources/flathub-badges/download.svg">
    <img alt="Download Sticky Notes on Flathub" src="data/resources/flathub-badges/download.svg">
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
