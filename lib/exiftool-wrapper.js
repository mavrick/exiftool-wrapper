'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.metadata = metadata;
exports.metadataSync = metadataSync;

var _child_process = require('child_process');

/**
 * Returns the metadata of the given source. Returns a Promise or uses the passed callback.
 *
 * @export
 * @param {object} options
 * @param {string|string[]|Buffer} options.source - The media for which we want to extract the metadata
 * @param {string[]} [options.tags] - List of metadata tags to whitelist or blacklist (add '-' before each tag). See [ExifTool Tag Names]{@link http://www.sno.phy.queensu.ca/%7Ephil/exiftool/TagNames/index.html} for available tags.
 * @param {boolean} [options.useBufferLimit=true] - Allows the limiting the size of the buffer that is piped into ExifTool
 * @param {number} [options.maxBufferSize=10000] - Size of the buffer that is piped into ExifTool
 * @param {string} [options.config] - load custom exiftool config file
 * @param {metadataCallback} [options.callback] - Callback that receives the metadata
 * @returns {Promise.<object[]>} A promise that contains the metadata for the media in an Array of Objects
 */
function metadata({ source, tags = [], useBufferLimit = true, maxBufferSize = 10000, config = null, callback = null }) {
  return new Promise((resolve, reject) => {
    process.nextTick(() => {
      if (!source) {
        let error = new TypeError('"source" must be a string, [string] or Buffer');
        tryCallback(callback, error);
        return reject(error);
      }
      let exifparams = prepareTags(tags);
      // "-j" for Exiftool json output
      exifparams.push('-j');

      let usingBuffer = false;

      if (Buffer.isBuffer(source)) {
        usingBuffer = true;
        exifparams.push('-'); // "-" for piping the buffer into Exiftool
      } else if (typeof source === 'string') {
        exifparams.push(source);
      } else if (Array.isArray(source)) {
        exifparams = exifparams.concat(source);
      } else {
        let error = new TypeError('"source" must be a string, [string] or Buffer');
        tryCallback(callback, error);
        reject(error);
      }

      if (config !== null) {
        exifparams.unshift(`${config}`);
        exifparams.unshift(`-config`);
      }

      let exif = (0, _child_process.spawn)('exiftool', exifparams);
      let exifdata = '';
      let exiferr = '';

      if (usingBuffer) {
        let buf = useBufferLimit ? source.slice(0, maxBufferSize) : source;
        exif.stdin.write(buf);
        exif.stdin.end();
      }

      exif.stdout.on('data', data => {
        exifdata += data;
      });
      exif.stderr.on('data', data => {
        exiferr += data;
      });
      exif.on('close', code => {
        try {
          var parseddata = JSON.parse(exifdata);
          if (parseddata.length === 1) {
            parseddata = parseddata[0];
          }
          tryCallback(callback, null, parseddata);
          return resolve(parseddata);
        } catch (e) {
          let error;
          if (exiferr.length > 0) {
            error = new Error(`Exiftool failed with exit code ${code}:\n ${exiferr}`);
          } else {
            error = new Error('Could not parse exiftool output!');
          }
          error.stderr = exiferr;
          error.stdout = exifdata;
          error.code = code;
          tryCallback(callback, error);
          return reject(error);
        }
      });
      // https://nodejs.org/api/child_process.html#child_process_event_error
      exif.on('error', reject);
    });
  });
}

/**
 * Returns the metadata of the given source synchroniously.
 *
 * @export
 * @param {object} options
 * @param {string|string[]|Buffer} options.source - The media for which we want to extract the metadata
 * @param {string[]} [options.tags] - List of metadata tags to whitelist or blacklist (add '-' before each tag). See [ExifTool Tag Names]{@link http://www.sno.phy.queensu.ca/%7Ephil/exiftool/TagNames/index.html} for available tags.
 * @param {boolean} [options.useBufferLimit=true] - Allows the limiting the size of the buffer that is piped into ExifTool
 * @param {number} [options.maxBufferSize=10000] - Size of the buffer that is piped into ExifTool
 * @returns {object[]} An array of objects that contains the metadata for each media
 */
function metadataSync({ source, tags, useBufferLimit = true, maxBufferSize = 10000, config = null }) {
  if (!source) {
    throw new Error('Undefined "source"');
  }
  let exifparams = prepareTags(tags);
  // "-j" for Exiftool json output
  exifparams.push('-j');

  let etdata;
  if (Buffer.isBuffer(source)) {
    // "-" for piping the buffer into Exiftool
    exifparams.push('-');
    let buf = useBufferLimit ? source.slice(0, maxBufferSize) : source;
    etdata = (0, _child_process.spawnSync)('exiftool', exifparams, { input: buf });
  } else if (typeof source === 'string') {
    exifparams.push(source);
    etdata = (0, _child_process.spawnSync)('exiftool', exifparams);
  } else if (Array.isArray(source)) {
    exifparams = exifparams.concat(source);
    etdata = (0, _child_process.spawnSync)('exiftool', exifparams);
  } else {
    throw new TypeError('"source" must be a string, [string] or Buffer');
  }

  if (config !== null) {
    exifparams.unshift(`${config}`);
    exifparams.unshift(`-config`);
  }

  try {
    var parseddata = JSON.parse(etdata.stdout);
    if (parseddata.length === 1) {
      parseddata = parseddata[0];
    }
    return parseddata;
  } catch (e) {
    let err = new Error('Could not parse data returned by ExifTool');
    err.commandlog = {
      stdout: etdata.stdout,
      stderr: etdata.stderr
    };
    throw err;
  }
}

// Helper function for tag preparation.
function tryCallback(cbfunction, error, result) {
  if (cbfunction) {
    cbfunction(error, result);
  }
}

// Helper function for tag preparation.
const prepareTags = tags => {
  if (tags) {
    return tags.map(tagname => `-${tagname}`);
  }
  return [];
};