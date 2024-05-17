import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
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

  handleOnGet(callback) {
    const mostRecentTime = this.platform.getRecentTime();
    const isOn = this.accessory.displayName === mostRecentTime;
    callback(null, isOn);
  }

  handleOnSet(value: CharacteristicValue, callback) {
    // Set the state
    callback(null);
  }
}
