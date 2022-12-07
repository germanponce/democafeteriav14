odoo.define('flexibite_ee_advance.ComboMaterialpadWidget', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    /**
     * @props client
     * @emits click-customer
     * @emits click-pay
     */
    class ComboMaterialpadWidget extends PosComponent {
        get isLongName() {
            return this.client && this.client.name.length > 10;
        }
        get client() {
            return this.props.client;
        }
    }
    ComboMaterialpadWidget.template = 'ComboMaterialpadWidget';

    Registries.Component.add(ComboMaterialpadWidget);

    return ComboMaterialpadWidget;
});
