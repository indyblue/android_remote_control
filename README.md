# Simple minicap/minitouch over WebSockets

Very lightweight android remote view/control over ADB.

## Requirements

* [Node.js](https://nodejs.org/) >= 0.12 (for this example only)
* [ADB](http://developer.android.com/intl/ja/tools/help/adb.html)
* An Android device with USB debugging enabled.

## Running

- get dependencies (npm install)
- start (node app.js)
- Open http://localhost:9002 in your browser.

## References

This entirely based on the STF (Smartphone Test Farm) code. It relies on prebuild versions of these libraries:
- https://github.com/openstf/minicap
- https://github.com/openstf/minitouch
- https://github.com/openstf/STFService.apk
- https://github.com/openstf/stf

notes:

- I used the sample code from minicap as a starting point
- minicap and minitouch are available prebuilt through npm. 
- The STFService.apk is retrievable through the stf repo. 
- The wire.proto is from the STFService repo. 
- The keycodes files were mostly copied from the stf repo.

## Raison d'etre

The STF project is great, but it has a lot of prerequisistes for running (RethinkDB, GraphicsMagick, ZeroMQ, ProtocolBuffers,, etc. Several of these I had to build from source. Nothing too bad, but time consuming. And I've never really used it as a "test farm," only to run a single phone, which seemed like overkill.

Then a few days ago I found the [adbmirror](https://github.com/fhorinek/adbmirror) project, which uses minicap and minitouch, and sparked my interest. I always wanted to know how the underlying technology worked in STF, so I started digging in. I started with the node sample in the minicap repo, and built out from there, adding minitouch and then the service stuff.