import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
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

interface ConfigOptions {
  refreshInterval: number;
  verboseLogging: boolean;
  logInterval: number;
}

export class ZmanimSwitches implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  public readonly accessories: PlatformAccessory[] = [];
  private recentTimeFile: string;
  private switchNames: Record<string, string>;
  private configOptions: ConfigOptions;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.recentTimeFile = path.join(this.api.user.persistPath(), 'recent_time.txt');
    this.switchNames = config.switchNames || {};
    this.configOptions = {
      refreshInterval: config.refreshInterval || 1,
      verboseLogging: config.verboseLogging || false,
      logInterval: config.logInterval || 60,
    };

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      this.initializeAccessories();
      this.scheduleStatusRefresh();
      this.scheduleVerboseLogging();
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

  scheduleStatusRefresh() {
    new CronJob(`*/${this.configOptions.refreshInterval} * * * *`, () => {
      this.updateSwitchStates();
    }, null, true, 'America/Chicago');
  }

  scheduleVerboseLogging() {
    if (this.configOptions.verboseLogging) {
      new CronJob(`*/${this.configOptions.logInterval} * * * *`, () => {
        const mostRecentTime = this.getRecentTime();
        const now = DateTime.now().setZone('America/Chicago');
        this.log.info(`Current time: ${now.toFormat('hh:mm a')}, Most recent zman: ${mostRecentTime}`);
      }, null, true, 'America/Chicago');
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

  getRecentTime(): string {
    if (fs.existsSync(this.recentTimeFile)) {
      return fs.readFileSync(this.recentTimeFile, 'utf8').trim();
    }
    return '';
  }

  applyLogicBasedOnMostRecentTime(mostRecentTime: string) {
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
