odoo.define('flexibite_ee_advance.GridOrderCard', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class GridOrderCard extends PosComponent {
        get headerClass(){
            if(this.props.order.order_type == 'Dine In'){
                return '#ff7477';
            }else if(this.props.order.order_type == 'Take Away'){
                return '#8bc34a';
            }else if(this.props.order.order_type == 'Delivery'){
                return '#00bcd4';
            }
        }
        get imageUrl() {
            if(this.isDineIn){
                return `/flexibite_ee_advance/static/src/img/table.png`;
            }else if(this.isTakeAway){
                return `/flexibite_ee_advance/static/src/img/takeaway.png`;
            }else if(this.isDelivery){
                return `/flexibite_ee_advance/static/src/img/delivery.png`;
            }
        }
        get isDineIn(){
            return this.props.order.order_type == 'Dine In';
        }
        get isTakeAway(){
            return this.props.order.order_type == 'Take Away';
        }
        get isDelivery(){
            return this.props.order.order_type == 'Delivery';
        }
        async clickGridCard(){
            const { confirmed } = await this.showPopup(
                'KitchenOrderCardPopup',
                {
                    order: this.props.order,
                }
            );
        }
    }
    GridOrderCard.template = 'GridOrderCard';

    Registries.Component.add(GridOrderCard);

    return GridOrderCard;
});
