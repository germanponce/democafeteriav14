odoo.define('flexibite_ee_advance.ComboReplacePopup', function(require) {
    'use strict';

    const { useState, useSubEnv } = owl.hooks;
    const PosComponent = require('point_of_sale.PosComponent');
    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const Registries = require('point_of_sale.Registries');
    const { useListener } = require('web.custom_hooks');

    class ComboReplacePopup extends AbstractAwaitablePopup {
        constructor() {
            super(...arguments);
            useListener('click-product', this._clickProduct);
            this.state = {
                selectedProduct: this.props.replacedProduct,
            };
        }
        async _clickProduct(event) {
            let product = event.detail;
            if (this.state.selectedProduct === product) {
                this.state.selectedProduct = null;
            } else {
                this.state.selectedProduct = product;
            }
            this.render();
        }
        getPayload() {
            var product = this.state.selectedProduct;
            return {
                product,
            };
        }
    }
    ComboReplacePopup.template = 'ComboReplacePopup';
    Registries.Component.add(ComboReplacePopup);

    return {
        ComboReplacePopup,
    };
});
