{
  description = "A simple Three.js project using Bun (no TypeScript or React)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShell = pkgs.mkShell {
          name = "three-bun-shell";

          buildInputs = [
            pkgs.bun
            pkgs.nodejs_24
          ];

          shellHook = ''
            echo "🎨 Simple Three.js + Bun dev shell"
            echo "Run: bun install"
            echo "Then: bun run dev (or however you start your server)"
          '';
        };

        packages.default = pkgs.stdenv.mkDerivation {
          pname = "three-bun-app";
          version = "0.1.0";
          src = ./.;

          nativeBuildInputs = [ pkgs.bun ];

          buildPhase = ''
            mkdir -p $out
            cp -r ./* $out/
            cd $out
            if [ -f package.json ]; then
              bun install || true
            fi
          '';

          installPhase = "true";

          meta = with pkgs.lib; {
            description = "Plain JS Three.js project bundled with Bun";
            license = licenses.mit;
          };
        };
      }
    );
}
