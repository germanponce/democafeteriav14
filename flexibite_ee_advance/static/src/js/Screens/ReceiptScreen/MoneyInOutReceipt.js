odoo.define('flexibite_ee_advance.MoneyInOutReceipt', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class MoneyInOutReceipt extends PosComponent {
        constructor() {
            super(...arguments);
        }
    }
    MoneyInOutReceipt.template = 'MoneyInOutReceipt';

    Registries.Component.add(MoneyInOutReceipt);

    return MoneyInOutReceipt;
});
