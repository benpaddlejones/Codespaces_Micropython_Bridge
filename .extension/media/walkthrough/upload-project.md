# Upload Your Project

Sync your entire MicroPython project to the Pico's filesystem.

## Uploading Files

Files stored on the Pico persist across reboots. This is useful for:

- **main.py** - Runs automatically on boot
- **Libraries** - Import modules from device storage
- **Configuration** - Store settings and data

## Project Structure

A typical MicroPython project:

```
project/
├── main.py           # Entry point, runs on boot
├── config.py         # Configuration settings
└── lib/              # Libraries and modules
    ├── mymodule.py
    └── sensors.py
```

## Syncing

1. Open the browser interface
2. Click **Sync Project**
3. Select files to upload
4. Wait for transfer to complete

## Tips

- The `project/` folder in your workspace is the default sync source
- Configure excluded folders in extension settings
- Large files take longer to transfer over serial
