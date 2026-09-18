const Xcomfort = require('xcomfort-shc-api');

if (typeof Xcomfort.prototype.setDeviceState !== 'function') {
  Xcomfort.prototype.setDeviceState = function setDeviceState(deviceName, state, cb) {
    const utils = require('xcomfort-shc-api/dist/utils');
    return utils.checkIfDeviceExists.call(this, deviceName).then(({ zoneId, id }) => {
      if (Number.isInteger(state) && (state < 0 || state > 100) || typeof state === 'string' && state !== 'on' && state !== 'off') {
        return Promise.reject('State value not valid (on/off or 0-100 integer)');
      }

      return this.query('StatusControlFunction/controlDevice', [zoneId, id, state.toString()]).then((res) => {
        return res && res.status === 'ok';
      });
    }).asCallback(cb);
  };
}

module.exports = Xcomfort;
