var util = require('util');
var os = require('os');
var exec = require('child_process').exec;
var debug = require('debug')('pm');

var bleno = require('bleno');

var Descriptor = bleno.Descriptor;
var Characteristic = bleno.Characteristic;

// Spec
//https://developer.bluetooth.org/gatt/characteristics/Pages/CharacteristicViewer.aspx?u=org.bluetooth.characteristic.cycling_power_measurement.xml

var CyclingPowerMeasurementCharacteristic = function() {
  CyclingPowerMeasurementCharacteristic.super_.call(this, {
    uuid: '2A63',
    properties: ['notify'],
    descriptors: [
      new Descriptor({
        // Client Characteristic Configuration
        uuid: '2902',
        value: new Buffer([0])
      }),
      new Descriptor({
        // Server Characteristic Configuration
        uuid: '2903',
        value: new Buffer([0])
      })
    ]
  });

  this._updateValueCallback = null;
};

util.inherits(CyclingPowerMeasurementCharacteristic, Characteristic);

CyclingPowerMeasurementCharacteristic.prototype.onSubscribe = function(maxValueSize, updateValueCallback) {
  console.log('[BLE] client subscribed to PM');
  this._updateValueCallback = updateValueCallback;
};

CyclingPowerMeasurementCharacteristic.prototype.onUnsubscribe = function() {
  console.log('[BLE] client unsubscribed from PM');
  this._updateValueCallback = null;
};

CyclingPowerMeasurementCharacteristic.prototype.notify = function(event) {
  if (!('watts' in event) && !('rev_count' in event)) {
    // ignore events with no power and no crank data
    return;
  }
  var buffer = new Buffer(14);
  // flags
  // 00000001 - 1   - 0x001 - Pedal Power Balance Present
  // 00000010 - 2   - 0x002 - Pedal Power Balance Reference
  // 00000100 - 4   - 0x004 - Accumulated Torque Present
  // 00001000 - 8   - 0x008 - Accumulated Torque Source
  // 00010000 - 16  - 0x010 - Wheel Revolution Data Present
  // 00100000 - 32  - 0x020 - Crank Revolution Data Present
  // 01000000 - 64  - 0x040 - Extreme Force Magnitudes Present
  // 10000000 - 128 - 0x080 - Extreme Torque Magnitudes Present
  buffer.writeUInt16LE(0x030, 0);

  var watts = ('watts' in event) ? event.watts : 0;
  debug("power: " + watts);
  buffer.writeInt16LE(watts, 2);

  var wheel_rev = ('dist' in event) ? event.dist : 0;
  debug("wheel revolution: " + wheel_rev);
  buffer.writeUInt32LE(wheel_rev, 4);

  var now = Date.now();
  var now_2048 = Math.floor(now * 2048 / 1e3);
  var wheel_event_time = now_2048 % 65536; // rolls over every 32 seconds
  debug("wheel event time: " + wheel_event_time);
  buffer.writeUInt16LE(wheel_event_time, 8);

  var rev_count = ('rev_count' in event) ? event.rev_count : 0;
  debug("crank revolution: " + rev_count);
  buffer.writeUInt16LE(rev_count, 10);

  var now_1024 = Math.floor(now * 1024 / 1e3);
  var crank_event_time = now_1024 % 65536; // rolls over every 64 seconds
  debug("crank event time: " + crank_event_time);
  buffer.writeUInt16LE(crank_event_time, 12);

  if (this._updateValueCallback) {
    this._updateValueCallback(buffer);
  }
}

module.exports = CyclingPowerMeasurementCharacteristic;
