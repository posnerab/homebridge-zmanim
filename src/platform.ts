import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import axios from 'axios';
import { CronJob } from 'cron';
import { DateTime } from 'luxon';
import * as fs from 'fs';
import * as path from 'path';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { ZmanimAccessory } from './platformAccessory';

const relevantZmanimKeys = [
  'chatzotNight', 'misheyakir', 'dawn', 'sunrise', 'sofZmanShma', 'sofZmanTfilla',
  'chatzot', 'minchaGedola', 'minchaKetana', 'plagHaMincha', 'sunset', 'beinHaShmashos', 'tzeit85deg',
];

interface MostRecentTime {
  label: string;
  time: DateTime;
}

interface CachedZmanim {
  [key: string]: string;
}

export class ZmanimSwitches implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  public readonly accessories: PlatformAccessory[] = [];
  private recentTimeFile: string;
  private zmanimFile: string;
  private zmanimUrl!: string;
  private switchNames: Record<string, string>;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.recentTimeFile = path.join(this.api.user.persistPath(), 'recent_time.txt');
    this.zmanimFile = path.join(this.api.user.persistPath(), 'zmanim.json');
    this.switchNames = config.switchNames || {};

    if (!config.geonameid) {
      this.log.error('Geoname ID is required for this plugin to function.');
      return;
    }

    const todayDate = DateTime.now().toFormat('yyyy-MM-dd');
    this.zmanimUrl = `https://www.hebcal.com/zmanim?cfg=json&geonameid=${config.geonameid}&date=${todayDate}`;

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      this.initializeAccessories();
      this.scheduleZmanimFetch();
      this.scheduleMostRecentTimeLog();
      this.fetchAndUpdateZmanim();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    accessory.context.device = accessory.displayName;
    this.accessories.push(accessory);
    new ZmanimAccessory(this, accessory);
  }

  initializeAccessories() {
    relevantZmanimKeys.forEach((key) => {
      const uuidKey = this.api.hap.uuid.generate(`homebridge-zmanim.${key}`);
      const existingAccessory = this.accessories.find(acc => acc.UUID === uuidKey);

      if (existingAccessory) {
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
        new ZmanimAccessory(this, existingAccessory);
      } else {
        const accessory = new this.api.platformAccessory(this.switchNames[key] || key, uuidKey);
        accessory.context.device = key;
        new ZmanimAccessory(this, accessory);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.accessories.push(accessory);
      }
    });

    this.updateSwitchStates();
  }

  scheduleZmanimFetch() {
    new CronJob('1 0 * * *', () => this.fetchAndUpdateZmanim(), null, true, 'America/Chicago');
  }

  scheduleMostRecentTimeLog() {
    new CronJob('*/5 * * * *', () => {
      const mostRecentTime = this.getRecentTime();
      this.log.info(`Most recent time: ${mostRecentTime}`);
    }, null, true, 'America/Chicago');
  }

  async fetchAndUpdateZmanim() {
    try {
      const response = await axios.get(this.zmanimUrl);
      const zmanim = response.data.times;
      fs.writeFileSync(this.zmanimFile, JSON.stringify(zmanim), 'utf8');
      this.log.info('Successfully fetched and cached Zmanim.');
      this.log.info('Zmanim for the day:', zmanim);
      this.updateMostRecentTime(zmanim);
    } catch (error) {
      this.log.error('Error fetching Zmanim:', error);
    }
  }

  updateMostRecentTime(zmanim: CachedZmanim) {
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
  }

  updateSwitchStates() {
    const mostRecentTime = this.getRecentTime();

    this.accessories.forEach((accessory) => {
      const service = accessory.getService(this.Service.Switch);
      if (service) {
        const isOn = accessory.displayName === mostRecentTime;
        service.updateCharacteristic(this.Characteristic.On, isOn);
        this.log.info(`Switch ${accessory.displayName} is now ${isOn ? 'ON' : 'OFF'}`);
      }
    });

    this.applyLogicBasedOnMostRecentTime(mostRecentTime);
  }

  getSwitchState(key, callback) {
    const mostRecentTime = this.getRecentTime();
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
        this.log.info(`Switch ${name} turned OFF`);
      }
    };

    const turnOn = (name: string) => {
      const accessory = this.accessories.find(acc => acc.displayName === name);
      if (accessory) {
        const service = accessory.getService(this.Service.Switch);
        service?.updateCharacteristic(this.Characteristic.On, true);
        this.log.info(`Switch ${name} turned ON`);
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
