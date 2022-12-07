odoo.define('flexibite_ee_advance.MaterialWidget', function(require) {
    'use strict';

    const { useState, useRef, onPatched } = owl.hooks;
    const { useListener } = require('web.custom_hooks');
    const { onChangeOrder } = require('point_of_sale.custom_hooks');
    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class MaterialWidget extends PosComponent {
        constructor() {
            super(...arguments);
            useListener('select-line', this._selectLine);
            useListener('click-reset-product', this._clickResetProduct);
            onChangeOrder(this._onPrevOrder, this._onNewOrder);
            this.scrollableRef = useRef('scrollable');
            this.scrollToBottom = false;
            onPatched(() => {
                // IMPROVEMENT
                // This one just stays at the bottom of the orderlines list.
                // Perhaps it is better to scroll to the added or modified orderline.
                if (this.scrollToBottom) {
                    this.scrollableRef.el.scrollTop = this.scrollableRef.el.scrollHeight;
                    this.scrollToBottom = false;
                }
            });
            this.state = useState({ total: 0, tax: 0 });
            this._updateSummary();
        }
        get order() {
            return this.env.pos.get_order();
        }
        get materiallinesArray() {
            return this.order ? this.order.get_materiallines() : [];
        }
        _selectLine(event) {
            this.order.select_materialline(event.detail.materialline);
        }
        async _clickResetProduct(event){
            const materialline = event.detail.materialline;
            materialline.set_is_replaced(false);
            materialline.set_description('');
            materialline.set_unit_price(0);
            materialline.set_price_extra(0);
            this.render();
        }
        _onNewOrder(order) {
            if (order) {
                order.materiallines.on(
                    'new-materialline-selected',
                    () => this.trigger('new-materialline-selected'),
                    this
                );
                order.materiallines.on('change', this._updateSummary, this);
                order.materiallines.on(
                    'add remove',
                    () => {
                        this.scrollToBottom = true;
                        this._updateSummary();
                    },
                    this
                );
                order.on('change', this.render, this);
            }
            this._updateSummary();
            this.trigger('new-materialline-selected');
        }
        _onPrevOrder(order) {
            if (order) {
                order.materiallines.off('new-materialline-selected', null, this);
                order.materiallines.off('change', null, this);
                order.materiallines.off('add remove', null, this);
                order.off('change', null, this);
            }
        }
        _updateSummary() {
            const addons = this.order ? this.order.m_get_total_without_tax(): 0;
            const price = this.order ? this.order.get_selected_orderline().get_lst_price() : 0;
            const price_extra = this.order ? this.order.get_selected_orderline().price_extra : 0;
            const total = this.order ? this.order.m_get_total_without_tax() + price + price_extra : 0;
            this.state.total = this.env.pos.format_currency(total);
            this.state.addons = this.env.pos.format_currency(addons);
            this.state.price = this.env.pos.format_currency(price + price_extra);
            this.render();
        }
    }
    MaterialWidget.template = 'MaterialWidget';

    Registries.Component.add(MaterialWidget);

    return MaterialWidget;
});
