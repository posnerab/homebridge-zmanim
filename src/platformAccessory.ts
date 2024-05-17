import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { ZmanimSwitches } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class ZmanimAccessory {
  private service: Service;

  constructor(
    private readonly platform: ZmanimSwitches,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Default-Manufacturer')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    // get the Switch service if it exists, otherwise create a new Switch service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Switch

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .on('get', this.handleOnGet.bind(this))               // GET - bind to the `handleOnGet` method below
      .on('set', this.handleOnSet.bind(this));              // SET - bind to the `handleOnSet` method below
  }

  /**
   * Handle "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of an accessory, for example, checking if a Switch is on.
   */
  handleOnGet(callback: (error: Error | null, value?: CharacteristicValue) => void) {
    const mostRecentTime = this.platform.getRecentTime();
    const isOn = this.accessory.displayName === mostRecentTime;
    callback(null, isOn);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Switch.
   */
  handleOnSet(value: CharacteristicValue, callback: () => void) {
    const isOn = value as boolean;
    this.platform.log.info(`Switch ${this.accessory.displayName} set to ${isOn ? 'ON' : 'OFF'}`);
    callback();
  }
}
