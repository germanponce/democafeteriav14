odoo.define('flexibite_ee_advance.ComboProductsWidgetControlPanel', function(require) {
    'use strict';

    const { useRef } = owl.hooks;
    const { debounce } = owl.utils;
    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class ComboProductsWidgetControlPanel extends PosComponent {
        constructor() {
            super(...arguments);
        }
    }
    ComboProductsWidgetControlPanel.template = 'ComboProductsWidgetControlPanel';

    Registries.Component.add(ComboProductsWidgetControlPanel);

    return ComboProductsWidgetControlPanel;
});
