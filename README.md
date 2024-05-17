# Homebridge Zmanim Switches

A Homebridge plugin that creates stateful switches for various Jewish prayer times (zmanim) fetched from the Hebcal API. The switches can be custom named and retain their state across Homebridge restarts.

## Features

- Stateful switches for various zmanim
- Custom switch names
- State persistence across Homebridge restarts
- Automatic updates based on the latest zmanim

## Installation

1. Install the plugin using npm:
    ```sh
    npm install -g homebridge-zmanim
    ```

2. Update your Homebridge `config.json`:
    ```json
    {
      "platforms": [
        {
          "name": "ZmanimSwitches",
          "geonameid": "5277142",
          "switchNames": {
            "chatzotNight": "Chatzot Night",
            "misheyakir": "Misheyakir",
            "dawn": "Dawn",
            "sunrise": "Sunrise",
            "sofZmanShma": "Sof Zman Shma",
            "sofZmanTfilla": "Sof Zman Tfilla",
            "chatzot": "Chatzot",
            "minchaGedola": "Mincha Gedola",
            "minchaKetana": "Mincha Ketana",
            "plagHaMincha": "Plag HaMincha",
            "sunset": "Sunset",
            "beinHaShmashos": "Bein HaShmashos",
            "tzeit85deg": "Tzeit 85 Deg"
          },
          "platform": "ZmanimSwitches"
        }
      ]
    }
    ```

3. Restart Homebridge.

## License

This project is licensed under the Apache-2.0 License.
