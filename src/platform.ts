import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import axios from 'axios';
import { CronJob } from 'cron';
import { DateTime } from 'luxon';
import * as fs from 'fs';
import * as path from 'path';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';

const relevantZmanimKeys = [
  'chatzotNight', 'misheyakir', 'dawn', 'sunrise', 'sofZmanShma', 'sofZmanTfilla',
  'chatzot', 'minchaGedola', 'minchaKetana', 'plagHaMincha', 'sunset', 'beinHaShmashos', 'tzeit85deg',
];

interface MostRecentTime {
  label: string;
  time: DateTime;
}

export class ZmanimSwitches implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  public readonly accessories: PlatformAccessory[] = [];
  private recentTimeFile: string;
  private zmanimUrl!: string;
  private switchNames: Record<string, string>;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.recentTimeFile = path.join(this.api.user.persistPath(), 'recent_time.txt');
    this.switchNames = config.switchNames || {};

    if (!config.geonameid) {
      this.log.error('Geoname ID is required for this plugin to function.');
      return;
    }

    this.zmanimUrl = `https://www.hebcal.com/zmanim?cfg=json&geonameid=${config.geonameid}`;

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      this.initializeAccessories();
      this.scheduleZmanimFetch();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  initializeAccessories() {
    relevantZmanimKeys.forEach((key) => {
      const uuidKey = this.api.hap.uuid.generate(`homebridge-zmanim.${key}`);
      const accessory = new this.api.platformAccessory(this.switchNames[key] || key, uuidKey);
      const service = accessory.addService(this.Service.Switch, this.switchNames[key] || key);

      service.getCharacteristic(this.Characteristic.On)
        .on('get', (callback) => this.getSwitchState(key, callback))
        .on('set', (value, callback) => this.setSwitchState(key, value, callback));

      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.accessories.push(accessory);
    });

    this.updateSwitchStates();
  }

  scheduleZmanimFetch() {
    new CronJob('0 2 * * *', () => this.fetchAndUpdateZmanim(), null, true, 'America/Chicago');
    this.fetchAndUpdateZmanim(); // Fetch immediately on startup
  }

  async fetchAndUpdateZmanim() {
    try {
      const response = await axios.get(this.zmanimUrl);
      const zmanim = response.data.times;
      this.log.info('Successfully fetched Zmanim.');
      const now = DateTime.now().setZone('America/Chicago');
      let mostRecentTime: MostRecentTime | null = null;

      for (const key of relevantZmanimKeys) {
        const zmanTime = DateTime.fromISO(zmanim[key]).setZone('America/Chicago');
        if (zmanTime <= now) {
          mostRecentTime = { label: key, time: zmanTime };
        }
      }

      if (mostRecentTime) {
        fs.writeFileSync(this.recentTimeFile, mostRecentTime.label, 'utf8');
        this.updateSwitchStates();
      }
    } catch (error) {
      this.log.error('Error fetching Zmanim:', error);
    }
  }

  updateSwitchStates() {
    const mostRecentTime = fs.existsSync(this.recentTimeFile) ? fs.readFileSync(this.recentTimeFile, 'utf8') : null;

    this.accessories.forEach((accessory) => {
      const service = accessory.getService(this.Service.Switch);
      if (service) {
        const isOn = accessory.displayName === mostRecentTime;
        service.updateCharacteristic(this.Characteristic.On, isOn);
      }
    });

    this.applyLogicBasedOnMostRecentTime(mostRecentTime);
  }

  getSwitchState(key, callback) {
    const mostRecentTime = fs.existsSync(this.recentTimeFile) ? fs.readFileSync(this.recentTimeFile, 'utf8') : null;
    const isOn = key === mostRecentTime;
    callback(null, isOn);
  }

  setSwitchState(key, value, callback) {
    this.updateSwitchStates();
    callback(null);
  }

  getRecentTime(): string | null {
    return fs.existsSync(this.recentTimeFile) ? fs.readFileSync(this.recentTimeFile, 'utf8') : null;
  }

  applyLogicBasedOnMostRecentTime(mostRecentTime: string | null) {
    const turnOff = (name: string) => {
      const accessory = this.accessories.find(acc => acc.displayName === name);
      if (accessory) {
        const service = accessory.getService(this.Service.Switch);
        service?.updateCharacteristic(this.Characteristic.On, false);
      }
    };

    const turnOn = (name: string) => {
      const accessory = this.accessories.find(acc => acc.displayName === name);
      if (accessory) {
        const service = accessory.getService(this.Service.Switch);
        service?.updateCharacteristic(this.Characteristic.On, true);
      }
    };

    if (mostRecentTime === 'chatzotNight') {
      turnOn('chatzotNight');
    } else if (mostRecentTime === 'misheyakir') {
      turnOn('misheyakir');
      turnOn('sofZmanShma');
      turnOn('sofZmanTfilla');
    } else if (mostRecentTime === 'dawn') {
      turnOff('misheyakir');
      turnOn('dawn');
      turnOn('sofZmanShma');
      turnOn('sofZmanTfilla');
    } else if (mostRecentTime === 'sunrise') {
      turnOff('dawn');
      turnOn('sunrise');
      turnOn('sofZmanShma');
      turnOn('sofZmanTfilla');
    } else if (mostRecentTime === 'sofZmanShma') {
      turnOn('sunrise');
      turnOff('sofZmanShma');
      turnOn('sofZmanTfilla');
    } else if (mostRecentTime === 'sofZmanTfilla') {
      turnOn('sunrise');
      turnOff('sofZmanShma');
      turnOff('sofZmanTfilla');
    } else if (mostRecentTime === 'chatzot') {
      turnOn('chatzot');
      turnOff('sunrise');
    } else if (mostRecentTime === 'minchaGedola') {
      turnOn('minchaGedola');
      turnOn('chatzot');
    } else if (mostRecentTime === 'minchaKetana') {
      turnOn('minchaKetana');
      turnOff('minchaGedola');
      turnOn('chatzot');
    } else if (mostRecentTime === 'plagHaMincha') {
      turnOn('plagHaMincha');
      turnOff('chatzot');
      turnOff('minchaKetana');
    } else if (mostRecentTime === 'sunset') {
      turnOff('plagHaMincha');
      turnOn('sunset');
    } else if (mostRecentTime === 'beinHaShmashos') {
      turnOff('sunrise');
      turnOn('beinHaShmashos');
    } else if (mostRecentTime === 'tzeit85deg') {
      turnOff('beinHaShmashos');
      turnOn('tzeit85deg');
    }
  }
}
