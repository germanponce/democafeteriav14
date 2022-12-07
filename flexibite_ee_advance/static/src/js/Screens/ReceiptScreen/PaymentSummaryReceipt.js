odoo.define('flexibite_ee_advance.PaymentSummaryReceipt', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class PaymentSummaryReceipt extends PosComponent {
        constructor() {
            super(...arguments);
        }
    }
    PaymentSummaryReceipt.template = 'PaymentSummaryReceipt';

    Registries.Component.add(PaymentSummaryReceipt);

    return PaymentSummaryReceipt;
});
