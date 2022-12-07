odoo.define('flexibite_ee_advance.OrderWidget', function(require) {
    'use strict';

    const OrderWidget = require('point_of_sale.OrderWidget');
    const { useState, useRef, onPatched } = owl.hooks;
    const { useListener } = require('web.custom_hooks');
    const { onChangeOrder } = require('point_of_sale.custom_hooks');
    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    const AsplResOrderWidget = OrderWidget =>
        class extends OrderWidget {
            constructor() {
                super(...arguments);
                useListener('customise-product', this._customiseProduct);
                useListener('edit-combo-product', this._editComboProduct);
                useListener('combo-product-info', this._comboProductInfo);
                useListener('material-product-info', this._materialProductInfo);
            }
            async _customiseProduct(event) {
                const orderline = event.detail.orderline;
                this.showScreen('CustomOrderScreen', {
                    product: orderline.product,
                    orderline: orderline,
                    full_name: orderline.get_full_product_name(),
                    edit: true,
                    mode: 'simple',
                });
            }
            async _editComboProduct(event) {
                const orderline = event.detail.orderline;
                this.showScreen('CreateComboScreen', {
                    product: orderline.product,
                    orderline: orderline,
                    full_name: orderline.get_full_product_name(),
                    edit: true,
                    mode: 'edit',
                });
            }
            async _comboProductInfo(event) {
                const { confirmed } = await this.showPopup(
                    'ComboInfoPopup',
                    {
                        title: event.detail.orderline.product.display_name,
                        list: event.detail.orderline.combolines,
                    }
                );
            }
            async _materialProductInfo(event) {
                const { confirmed } = await this.showPopup(
                    'MaterialInfoPopup',
                    {
                        title: event.detail.orderline.product.display_name,
                        list: event.detail.orderline.materiallines,
                    }
                );
            }
        };

    Registries.Component.extend(OrderWidget, AsplResOrderWidget);

    return OrderWidget;
});
