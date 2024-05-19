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
    try {
      const mostRecentTime = this.platform.getRecentTime();
      const isOn = this.accessory.displayName === mostRecentTime.label;
      this.platform.log.debug(`Get request for ${this.accessory.displayName}: ${isOn}`);
      callback(null, isOn);
    } catch (error) {
      this.platform.log.error(`Error in handleOnGet for ${this.accessory.displayName}:`, error);
      callback(error as Error);
    }
  }

  handleOnSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    try {
      const isOn = value as boolean;
      this.platform.log.debug(`Set request for ${this.accessory.displayName}: ${isOn}`);
      this.platform.log.info(`Switch ${this.accessory.displayName} set to ${isOn ? 'ON' : 'OFF'}`);
      callback(null);
    } catch (error) {
      this.platform.log.error(`Error in handleOnSet for ${this.accessory.displayName}:`, error);
      callback(error as Error);
    }
  }
}
