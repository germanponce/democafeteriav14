odoo.define('flexibite_ee_advance.OpenDetailButton', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const ProductScreen = require('point_of_sale.ProductScreen');
    const { useState } = owl.hooks;
    const { useListener } = require('web.custom_hooks');
    const Registries = require('point_of_sale.Registries');

    class OpenDetailButton extends PosComponent {
        constructor() {
            super(...arguments);
            this.state = useState({ flag: false, componentFlag: false});
            useListener('close-side-menu', () => this.toggle('flag'));
        }
        toggle(key) {
            this.trigger('close-side-sub-menu')
            this.state[key] = !this.state[key];
        }
    }
    OpenDetailButton.template = 'OpenDetailButton';

    Registries.Component.add(OpenDetailButton);

    return OpenDetailButton;
});
