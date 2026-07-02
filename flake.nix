{
  description = "Sticky Notes — GNOME sticky notes app (with tray icon)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (
        system: f system nixpkgs.legacyPackages.${system}
      );
    in
    {
      packages = forAllSystems (system: pkgs: {
        # reuses the nixpkgs sticky-notes derivation (same version, same
        # yarn.lock, so the yarn offline cache hash still applies) but builds
        # from this source tree
        default = pkgs.sticky-notes.overrideAttrs (old: {
          version = "${old.version}-dev";
          src = self;
        });
      });

      apps = forAllSystems (system: pkgs: {
        # nix run — build and launch the app
        default = {
          type = "app";
          program = "${self.packages.${system}.default}/bin/com.vixalien.sticky";
          meta.description = "Run Sticky Notes built from this source tree";
        };

        # nix run .#install-appindicator — link the AppIndicator GNOME Shell
        # extension (a StatusNotifierWatcher host) into the user profile, so
        # the tray icon can be tested with and without it
        install-appindicator = {
          type = "app";
          program = toString (pkgs.writeShellScript "install-appindicator" ''
            set -eu
            uuid=appindicatorsupport@rgcjonas.gmail.com
            src=${pkgs.gnomeExtensions.appindicator}/share/gnome-shell/extensions/$uuid
            dest="$HOME/.local/share/gnome-shell/extensions/$uuid"
            mkdir -p "$(dirname "$dest")"
            ln -sfT "$src" "$dest"
            echo "AppIndicator extension linked into $dest"
            echo
            echo "GNOME Shell only picks up new extensions on login:"
            echo "log out and back in, then run:"
            echo
            echo "  gnome-extensions enable $uuid"
            echo
            echo "Toggle it off/on with gnome-extensions disable/enable (or the"
            echo "Extensions app) to compare behavior; remove it again with:"
            echo
            echo "  rm '$dest'"
          '');
          meta.description = "Install the AppIndicator extension for the current user";
        };
      });

      devShells = forAllSystems (system: pkgs: {
        default = pkgs.mkShell {
          # meson/ninja/yarn/gjs toolchain and GTK/libadwaita libraries, with
          # the GI and GSettings setup hooks, exactly as the package build
          inputsFrom = [ self.packages.${system}.default ];

          packages = [
            pkgs.gjs # on PATH for running the app uninstalled
            pkgs.nodejs # yarn typecheck
            pkgs.libxml2 # xmllint, silences a gresource warning

            # build and run the app from the working tree:
            #   sticky-run [args...]
            # GJS only registers the compiled-in source gresource for
            # installed apps, so overlay the resource path onto the build dir
            (pkgs.writeShellScriptBin "sticky-run" ''
              set -eu
              [ -d build ] || meson setup build
              ninja -C build
              cd build
              export GSETTINGS_SCHEMA_DIR="$PWD/data"
              export G_RESOURCE_OVERLAYS="/com/vixalien/sticky/js=$PWD/src"
              exec gjs -m src/com.vixalien.sticky "$@"
            '')
          ];

          shellHook = ''
            echo "Sticky Notes dev shell"
            echo "  sticky-run        build and run from the working tree"
            echo "  yarn typecheck    check TypeScript (needs the gi-types submodule)"
          '';
        };
      });
    };
}
