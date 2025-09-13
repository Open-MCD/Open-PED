// XML Utilities for parsing and building XML
const { XMLParser } = require('fast-xml-parser');

const parser = new XMLParser();

function parseXml(xmlString) {
    return new Promise((resolve, reject) => {
        try {
            const result = parser.parse(xmlString);
            resolve(result);
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = { parseXml };
