    odoo.define('point_of_sale.GiftVoucherHistoryLine', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class GiftVoucherHistoryLine extends PosComponent {
        get highlight() {
            return this.props.gift_card !== this.props.selectedVoucher ? '' : 'highlight';
        }
    }
    GiftVoucherHistoryLine.template = 'GiftVoucherHistoryLine';

    Registries.Component.add(GiftVoucherHistoryLine);

    return GiftVoucherHistoryLine;
});
