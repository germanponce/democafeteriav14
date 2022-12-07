odoo.define('flexibite_ee_advance.ComboProductList', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');
    const { useState } = owl.hooks;
    const { useListener } = require('web.custom_hooks');

    class ComboProductList extends PosComponent {
        constructor() {
            super(...arguments);

            this.state = useState({});
        }
        get productQuantityLine(){
            return this.props.quantityLine[this.props.selected_id]
        }
    }
    ComboProductList.template = 'ComboProductList';

    Registries.Component.add(ComboProductList);

    return ComboProductList;
});
