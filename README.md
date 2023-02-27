# Sticky Notes

Sticky Notes is a simple note taking application for the GNOME desktop. It is
written in GJS and uses GTK4.

<div style="display: flex; align-items: center; flex-wrap: wrap; justify-content: center;">
  <img src=".github/note.png" alt="Note"/>
  <img src=".github/notes.png" alt="All notes"/>
</div>

## Installation

### From source

To install from source, you need `nodejs` installed. Then, you need to clone the
repository and run the following commands:

```sh
meson setup build
ninja -C build
sudo ninja -C build install
```

Tips:

- If you want to run the application without installing it, you can run
  `ninja -C build devel` instead of `sudo ninja -C build install`.
- If you use a different node package manager (like `pnpm`, `bun` etc), you can
  use `meson configure build -Dpackage-manager=<your package manager>` to set
  the package manager. The package manager must support the `install` and `run`
  commands.
