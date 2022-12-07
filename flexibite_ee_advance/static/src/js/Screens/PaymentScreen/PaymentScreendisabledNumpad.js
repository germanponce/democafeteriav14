odoo.define('flexipharmacy_ee.PaymentScreendisabledNumpad', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class PaymentScreendisabledNumpad extends PosComponent {
        constructor() {
            super(...arguments);
            this.decimalPoint = this.env._t.database.parameters.decimal_point;
        }
    }
    PaymentScreendisabledNumpad.template = 'PaymentScreendisabledNumpad';

    Registries.Component.add(PaymentScreendisabledNumpad);

    return PaymentScreendisabledNumpad;
});
