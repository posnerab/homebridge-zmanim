import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';
import { ZmanimSwitches } from './platform';

export class ZmanimAccessory {
  private service: Service;

  constructor(
    private readonly platform: ZmanimSwitches,
    private readonly accessory: PlatformAccessory,
  ) {
    this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);

    this.service.getCharacteristic(this.platform.Characteristic.On)
      .on('get', this.handleOnGet.bind(this))
      .on('set', this.handleOnSet.bind(this));
  }

  handleOnGet(callback: CharacteristicGetCallback) {
    const done = (error: Error | null, value?: CharacteristicValue) => {
      try {
        callback(error, value);
      } catch (err) {
        this.platform.log.error(`Error in handleOnGet callback for ${this.accessory.displayName}:`, err);
      }
    };

    try {
      const mostRecentTime = this.platform.getRecentTime();
      const isOn = this.accessory.displayName === mostRecentTime.label;
      this.platform.log.debug(`Get request for ${this.accessory.displayName}: ${isOn}`);
      done(null, isOn);
    } catch (error) {
      this.platform.log.error(`Error in handleOnGet for ${this.accessory.displayName}:`, error);
      done(error as Error);
    }
  }

  handleOnSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const done = (error: Error | null) => {
      try {
        callback(error);
      } catch (err) {
        this.platform.log.error(`Error in handleOnSet callback for ${this.accessory.displayName}:`, err);
      }
    };

    try {
      const isOn = value as boolean;
      this.platform.log.debug(`Set request for ${this.accessory.displayName}: ${isOn}`);
      this.platform.log.info(`Switch ${this.accessory.displayName} set to ${isOn ? 'ON' : 'OFF'}`);
      done(null);
    } catch (error) {
      this.platform.log.error(`Error in handleOnSet for ${this.accessory.displayName}:`, error);
      done(error as Error);
    }
  }
}