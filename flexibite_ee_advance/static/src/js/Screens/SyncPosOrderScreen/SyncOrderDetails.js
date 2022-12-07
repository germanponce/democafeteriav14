odoo.define('flexibite_ee_advance.SyncOrderDetails', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');
    /**
     * @props {models.Order} order
     */
    class SyncOrderDetails extends PosComponent {
        get order() {
            return this.props.order;
        }
        get orderlines() {
            return this.order ? this.order.orderlines.models : [];
        }
        get total() {
            return this.env.pos.format_currency(this.order ? this.order.get_total_with_tax() : 0);
        }
        get tax() {
            return this.env.pos.format_currency(this.order ? this.order.get_total_tax() : 0)
        }
        getDate(order) {
            return moment(order.order_time).format('YYYY-MM-DD hh:mm A');
        }

    }
    SyncOrderDetails.template = 'SyncOrderDetails';

    Registries.Component.add(SyncOrderDetails);

    return SyncOrderDetails;
});
