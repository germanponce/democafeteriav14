odoo.define('flexibite_ee_advance.MaterialReplacePopup', function(require) {
    'use strict';

    const { useState, useSubEnv, useExternalListener } = owl.hooks;
    const PosComponent = require('point_of_sale.PosComponent');
    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const Registries = require('point_of_sale.Registries');
    const { useListener } = require('web.custom_hooks');

    class MaterialReplacePopup extends AbstractAwaitablePopup {
        constructor() {
            super(...arguments);
            useListener('click-product', this._clickProduct);
            useExternalListener(window, 'click', this._clickOutside);
            this.state = {
                selectedProduct: this.props.replacedProduct || null,
            };
        }
        async _clickProduct(event) {
            const product = event.detail;
            if (this.state.selectedProduct === product) {
                this.state.selectedProduct = null;
            } else {
                this.state.selectedProduct = product;
            }

        }
        _clickOutside(){
            this.state.selectedProduct = null;
        }

        getPayload() {
            var product = this.state.selectedProduct;
            return {
                product,
            };
        }
    }
    MaterialReplacePopup.template = 'MaterialReplacePopup';
    Registries.Component.add(MaterialReplacePopup);

    class ReplaceProductItem extends PosComponent {
        get imageUrl() {
            const product = this.props.product;
            return `/web/image?model=product.product&field=image_128&id=${product.id}&write_date=${product.write_date}&unique=1`;
        }
     }
    ReplaceProductItem.template = 'ReplaceProductItem';
    Registries.Component.add(ReplaceProductItem);

    return {
        MaterialReplacePopup,
        ReplaceProductItem,
    };
});
