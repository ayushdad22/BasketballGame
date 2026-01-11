{
  description = "Basketball backboard detection with TensorFlow and Node.js";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        python = pkgs.python311;
        pythonPackages = python.pkgs;
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            # Python dependencies
            python
            pythonPackages.pip
            pythonPackages.virtualenv
            pythonPackages.tensorflow
            pythonPackages.opencv4
            pythonPackages.pandas
            pythonPackages.numpy
            pythonPackages.matplotlib
            pythonPackages.pillow
            pythonPackages.scikit-learn
            pythonPackages.flask
            pythonPackages.flask-cors
            
            # Node.js dependencies
            pkgs.nodejs_20
            pkgs.ffmpeg
            pkgs.yt-dlp
            
            # System libraries for OpenCV and Canvas
            pkgs.libGL
            pkgs.glib
            pkgs.libxcrypt-legacy
            pkgs.libuuid
            pkgs.cairo
            pkgs.pango
            pkgs.pixman
            pkgs.freetype
            pkgs.fontconfig
            pkgs.harfbuzz
            pkgs.pkg-config
          ];

          shellHook = ''
            echo "Basketball Backboard Detection Environment"
            echo "Python: $(python --version)"
            echo "Node: $(node --version)"
            echo "FFmpeg: $(ffmpeg -version | head -n1)"
            
            # Set LD_LIBRARY_PATH for TensorFlow and OpenCV
            export LD_LIBRARY_PATH=${pkgs.stdenv.cc.cc.lib}/lib:${pkgs.zlib}/lib:${pkgs.libGL}/lib:${pkgs.glib.out}/lib:${pkgs.libuuid.lib}/lib:${pkgs.cairo}/lib:${pkgs.pango.out}/lib:${pkgs.freetype}/lib:${pkgs.fontconfig.lib}/lib:${pkgs.harfbuzz}/lib:$LD_LIBRARY_PATH
            export PKG_CONFIG_PATH=${pkgs.cairo}/lib/pkgconfig:${pkgs.pango.dev}/lib/pkgconfig:${pkgs.pixman}/lib/pkgconfig:$PKG_CONFIG_PATH
            
            # Create virtual environment if it doesn't exist
            if [ ! -d "venv" ]; then
              echo "Creating virtual environment..."
              python -m venv venv
            fi
            
            source venv/bin/activate
            pip install --upgrade pip
            
            # Install Python packages if not already installed
            if ! python -c "import tensorflow" 2>/dev/null; then
              echo "Installing Python packages..."
              pip install tensorflow opencv-python pandas numpy matplotlib pillow scikit-learn flask flask-cors
            fi
            
            # Install Node dependencies if package.json exists
            if [ -f "package.json" ]; then
              echo "Installing Node dependencies..."
              npm install
            fi
          '';
        };
      }
    );
}