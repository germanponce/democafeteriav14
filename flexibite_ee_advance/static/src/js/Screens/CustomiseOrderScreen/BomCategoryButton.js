odoo.define('flexibite_ee_advance.BomCategoryButton', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class BomCategoryButton extends PosComponent {
        get addedClasses() {
            return {
                c_selected : this.props.category.id == this.props.selected_id ? true : false,
            };
        }
    }
    BomCategoryButton.template = 'BomCategoryButton';

    Registries.Component.add(BomCategoryButton);

    return BomCategoryButton;
});