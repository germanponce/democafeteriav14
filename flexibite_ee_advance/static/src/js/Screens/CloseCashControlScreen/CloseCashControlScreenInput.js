odoo.define('flexibite_ee_advance.CloseCashControlScreenInput', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');
    const { useListener } = require('web.custom_hooks');
    const { debounce } = owl.utils;
    const { useState } = owl.hooks;

    class CloseCashControlScreenInput extends PosComponent {
        constructor() {
            super(...arguments);
        }
        onKeyDown(e) {
            if(e.which != 110 && e.which != 8 && e.which != 0 && e.key != this.env.pos.db.decimalSeparator() && e.key != this.env.pos.db.decimalSeparator() && (e.which < 48 || e.which > 57 || e.shiftKey) && (e.which < 96 || e.which > 105) && (e.which < 37 || e.which > 40)) {
                e.preventDefault();
            }
            if(e.which == 9 || e.which == 13) {
                this.props.line.line_total = this.env.pos.db.thousandsDecimalChanger(this.props.line.coin_value) * this.env.pos.db.thousandsDecimalChanger(this.props.line.number_of_coins);
                this.trigger('closing-main_total');
            }else if(e.which == 190){
               e.preventDefault();
            }
        }
        focusOut() {
            this.props.line.line_total = this.env.pos.db.thousandsDecimalChanger(this.props.line.coin_value) * this.env.pos.db.thousandsDecimalChanger(this.props.line.number_of_coins);
            this.trigger('closing-main_total');
        }

    }

    CloseCashControlScreenInput.template = 'CloseCashControlScreenInput';

    Registries.Component.add(CloseCashControlScreenInput);

    return CloseCashControlScreenInput;
});

