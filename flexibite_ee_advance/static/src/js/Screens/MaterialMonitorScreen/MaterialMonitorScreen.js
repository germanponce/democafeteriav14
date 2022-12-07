    odoo.define('flexibite_ee_advance.MaterialMonitorScreen', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');
    const { debounce } = owl.utils;
    const { useState, useRef } = owl.hooks;
    var rpc = require('web.rpc');
    
    
    class MaterialMonitorScreen extends PosComponent {
        constructor() {
            super(...arguments);
            this.searchWordInput = useRef('search-word-input');
            this.updateSearch = debounce(this.updateSearch, 100);
            this.state = useState({ location_id: this.DefaultLocation});
            this.env.pos.set('MeterialLocation', this.state.location_id)
        }
        close() {
            this.trigger('clear-search');
            this.showScreen('ProductScreen');
        }
        get LocationName(){
            if(this.state.location_id){
                return this.state.location_id.name
            }else{
                return 'Location'
            }
        }
        get DefaultLocation(){
            return this.env.pos.stock_location.filter((location) => location.id === this.env.pos.default_stock_pick_type[0].default_location_src_id[0])[0]
        }
        async SelectLocation(){
            const selectionLocation = this.env.pos.stock_location.map(location_id => ({
                id: location_id.id,
                label: location_id.name,
                isSelected: location_id.id === this.state.location_id.id,
                item: location_id,
            }));

            const { confirmed, payload: selectedLocation } = await this.showPopup(
                'SelectionPopup',
                {
                    title: this.env._t('Select the Location'),
                    list: selectionLocation,
                }
            );

            if (confirmed) {
                this.state.location_id = selectedLocation;
                this.material_monitor_data(this.state.location_id);
                this.env.pos.set('MeterialLocation', this.state.location_id)
                
                // this.env.pos.get_order().set_product_location(selectedLocation)
                // this.state.location_id = this.env.pos.get_order().get_product_location()
                // this.env.pos.get_order().material_monitor_data();
            }
        }
        async material_monitor_data(location){
            var self = this;
            var vals = this.env.pos.db.product_by_id;
            await rpc.query({
                model: 'product.product',
                method: 'broadcast_product_qty_data',
                args: [vals, this.env.pos.db.product_by_id, location.id],
            })
            .then(function(result) {});
        }
    }
    MaterialMonitorScreen.template = 'MaterialMonitorScreen';

    Registries.Component.add(MaterialMonitorScreen);

    return MaterialMonitorScreen;
});
