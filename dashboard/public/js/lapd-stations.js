/* LAPD Police Station Badge Layer — shared across all Leaflet maps */
(function () {
  'use strict';

  var BADGE_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="40" viewBox="0 0 34 40">' +
    '<path d="M17 1 L31 7 L31 21 Q31 34 17 39 Q3 34 3 21 L3 7 Z"' +
    ' fill="rgba(0,10,30,0.92)" stroke="#00bfff" stroke-width="1.7"/>' +
    '<path d="M17 4.5 L28 9.5 L28 21 Q28 31.5 17 36 Q6 31.5 6 21 L6 9.5 Z"' +
    ' fill="none" stroke="rgba(0,191,255,0.28)" stroke-width="0.8"/>' +
    '<polygon points="17,10.5 18.6,15.7 24.2,15.7 19.8,18.9 21.4,24.1 17,20.9 12.6,24.1 14.2,18.9 9.8,15.7 15.4,15.7"' +
    ' fill="#00bfff" opacity="0.94"/>' +
    '<text x="17" y="34.5" text-anchor="middle" fill="#00bfff"' +
    ' font-size="5.5" font-family="monospace" font-weight="bold" letter-spacing="0.8">LAPD</text>' +
    '</svg>';

  var BADGE_HTML =
    '<div style="width:34px;height:40px;filter:drop-shadow(0 0 8px rgba(0,191,255,0.80))">' +
    BADGE_SVG + '</div>';

  function injectStyles() {
    if (document.getElementById('lapd-stn-css')) return;
    var s = document.createElement('style');
    s.id = 'lapd-stn-css';
    s.textContent =
      '.stn-popup .leaflet-popup-content-wrapper{' +
        'background:rgba(0,6,20,0.94);' +
        'border:1px solid rgba(0,191,255,0.28);' +
        'border-radius:4px;' +
        'box-shadow:0 0 22px rgba(0,191,255,0.18);' +
        'color:#e2e8f0;' +
        'padding:0;' +
      '}' +
      '.stn-popup .leaflet-popup-content{margin:10px 14px;}' +
      '.stn-popup .leaflet-popup-tip{background:rgba(0,40,80,0.90);}' +
      '.stn-popup .leaflet-popup-close-button{color:#00bfff!important;font-size:18px!important;top:4px!important;right:6px!important;}';
    document.head.appendChild(s);
  }

  function toTitle(str) {
    return str.split(' ').map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');
  }

  function popupHTML(p) {
    return (
      '<div style="font:700 12px/1.4 \'Courier New\',monospace;color:#00bfff;margin-bottom:5px">' +
        '<span style="opacity:.55">◈ </span>' + toTitle(p.division) + ' Division' +
      '</div>' +
      '<div style="font:11px/1.6 \'Courier New\',monospace;color:#94a3b8">' + p.address + '</div>' +
      '<div style="font:700 9px \'Courier New\',monospace;color:rgba(0,191,255,0.45);margin-top:5px;letter-spacing:.1em">' +
        'LAPD PRECINCT ' + p.prec +
      '</div>'
    );
  }

  window.addPoliceStations = function (map) {
    injectStyles();

    var icon = L.divIcon({
      html: BADGE_HTML,
      className: '',
      iconSize:   [34, 40],
      iconAnchor: [17, 40],
      popupAnchor:[0, -44],
    });

    fetch('/data/lapd_stations.geojson')
      .then(function (r) { return r.json(); })
      .then(function (gj) {
        L.geoJSON(gj, {
          pointToLayer: function (feat, ll) {
            return L.marker(ll, { icon: icon, zIndexOffset: 2000 });
          },
          onEachFeature: function (feat, layer) {
            layer.bindPopup(popupHTML(feat.properties), {
              maxWidth: 240,
              className: 'stn-popup',
            });
          },
        }).addTo(map);
      })
      .catch(function () {});
  };
})();
