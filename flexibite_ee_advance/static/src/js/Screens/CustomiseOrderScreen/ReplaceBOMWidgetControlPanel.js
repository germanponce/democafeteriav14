odoo.define('flexibite_ee_advance.ReplaceBOMWidgetControlPanel', function(require) {
    'use strict';

    const { useRef } = owl.hooks;
    const { debounce } = owl.utils;
    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class ReplaceBOMWidgetControlPanel extends PosComponent {
        constructor() {
            super(...arguments);
        }
    }
    ReplaceBOMWidgetControlPanel.template = 'ReplaceBOMWidgetControlPanel';

    Registries.Component.add(ReplaceBOMWidgetControlPanel);

    return ReplaceBOMWidgetControlPanel;
});