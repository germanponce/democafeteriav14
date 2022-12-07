odoo.define('flexibite_ee_advance.OrderSummaryReceipt', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class OrderSummaryReceipt extends PosComponent {
        constructor() {
            super(...arguments);
        }
    }
    OrderSummaryReceipt.template = 'OrderSummaryReceipt';

    Registries.Component.add(OrderSummaryReceipt);

    return OrderSummaryReceipt;
});
