odoo.define('flexibite_ee_advance.ComboWidget', function(require) {
    'use strict';

    const { useState, useRef, onPatched } = owl.hooks;
    const { useListener } = require('web.custom_hooks');
    const { onChangeOrder } = require('point_of_sale.custom_hooks');
    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class ComboWidget extends PosComponent {
        constructor() {
            super(...arguments);
            useListener('select-line', this._selectLine);
            onChangeOrder(this._onPrevOrder, this._onNewOrder);
            this.scrollableRef = useRef('scrollable');
            this.topRef = useRef('top');
            this.scrollToBottom = false;
            onPatched(() => {
                // IMPROVEMENT
                // This one just stays at the bottom of the orderlines list.
                // Perhaps it is better to scroll to the added or modified orderline.
                if (this.scrollToBottom) {
                    if(this.topRef.el != null){
                        this.scrollableRef.el.scrollTop = this.topRef.el.offsetTop - 20;
                    }else{
                        this.scrollableRef.el.scrollTop = this.state.top -20;
                    }
                    this.scrollToBottom = false;

                }
            });
            this.state = useState({ total: 0, extra: 0, top: 0 });
            this._updateSummary();
        }
        get order() {
            return this.env.pos.get_order();
        }
        get combolinesArray() {
            return this.order ? this.order.get_combolines() : [];
        }
        _selectLine(event) {
            this.order.select_comboline(event.detail.comboline);
            this.state.top = event.detail.top;
            this.scrollableRef.el.scrollTop = this.state.top - 20;

        }
        _onNewOrder(order) {
            if (order) {
                order.combolines.on(
                    'new-comboline-selected',
                    () => this.trigger('new-comboline-selected'),
                    this
                );
                order.combolines.on('change', this._updateSummary, this);
                order.combolines.on(
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
            this.trigger('new-comboline-selected');
        }
        _onPrevOrder(order) {
            if (order) {
                order.combolines.off('new-comboline-selected', null, this);
                order.combolines.off('change', null, this);
                order.combolines.off('add remove', null, this);
                order.off('change', null, this);
            }
        }
        _updateSummary() {
            const extra = this.order.c_get_total_without_tax();
            const price = this.order.get_selected_orderline().get_lst_price();
            const total = extra + price;
            this.state.extra = this.env.pos.format_currency(extra);
            this.state.price = this.env.pos.format_currency(price);
            this.state.total = this.env.pos.format_currency(total);
            this.render();
        }
    }
    ComboWidget.template = 'ComboWidget';

    Registries.Component.add(ComboWidget);

    return ComboWidget;
});
