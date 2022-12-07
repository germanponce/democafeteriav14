odoo.define('flexibite_ee_advance.Orderline', function(require) {
    'use strict';

    const Orderline = require('point_of_sale.Orderline');
    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    const AsplResOrderline = Orderline =>
        class extends Orderline {
            customiseIconClicked() {
                this.trigger('customise-product', { orderline: this.props.line });
            }
            comboIconClicked() {
                this.trigger('edit-combo-product', { orderline: this.props.line });
            }
            comboInfoButtonClicked() {
                this.trigger('combo-product-info', { orderline: this.props.line });
            }
            materialInfoButtonClicked() {
                this.trigger('material-product-info', { orderline: this.props.line });
            }
            get addStateColor(){
                if(this.props.line.state == 'Waiting'){
                    return '#555555';
                }else if(this.props.line.state == 'Preparing'){
                    return '#f44336';
                }else if(this.props.line.state == 'Delivering'){
                    return '#795548';
                }
            }
            async DeleteLineFromOrder(line){
                if (this.env.pos.user.delete_order_line_reason){
                    const reasonPosList = []
                    for (let reasonPos of this.env.pos.remove_product_reason) {
                        reasonPosList.push({
                            id: reasonPos.id,
                            label: reasonPos.name,
                            item: reasonPos,
                        });
                    }
                    const { confirmed, payload: selectedreason } = await this.showPopup(
                    'SelectionPopup',
                        {
                            title: this.env._t('Select Reason'),
                            list: reasonPosList,
                        }
                    );
                    if (confirmed) {
                        if (selectedreason.description){
                            const { confirmed, payload: inputNote } = await this.showPopup('TextAreaPopup', {
                                title: this.env._t('Add Reason'),
                            });
                            if (confirmed) {
                                var reason = {
                                    'product': line.product.id,
                                    'reason_id': selectedreason.id,
                                    'description': inputNote
                                }
                                this.env.pos.get_order().set_cancle_product_reason(reason)
                                await this.env.pos.get_order().set_delete_product(true)
                                line.set_quantity('remove')
                                this.env.pos.sync_from_server(this.env.pos.table, this.env.pos.get_order_list(), this.env.pos.get_order_with_uid());
                                return false
                            }
                        }else{
                            var reason = {
                                'product': line.product.id,
                                'reason_id': selectedreason.id,
                                'description': ""
                            }
                            await this.env.pos.get_order().set_cancle_product_reason(reason)
                            await this.env.pos.get_order().set_delete_product(true)
                            line.set_quantity('remove')
                            this.env.pos.sync_from_server(this.env.pos.table, this.env.pos.get_order_list(), this.env.pos.get_order_with_uid());
                            return false
                        }
                    }
                }else{
                    var reason = {
                        'product': line.product.id,
                        'reason_id': '',
                        'description': ""
                    }
                    await this.env.pos.get_order().set_cancle_product_reason(reason)
                    line.set_quantity('remove')
                    await this.env.pos.get_order().set_delete_product(true)
                    this.env.pos.sync_from_server(this.env.pos.table, this.env.pos.get_order_list(), this.env.pos.get_order_with_uid());
                    return false
                }
            }
        };

    Registries.Component.extend(Orderline, AsplResOrderline);

    return Orderline;
});
