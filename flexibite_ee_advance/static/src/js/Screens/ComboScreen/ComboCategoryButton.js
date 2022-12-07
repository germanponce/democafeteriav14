odoo.define('flexibite_ee_advance.ComboCategoryButton', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class ComboCategoryButton extends PosComponent {
        get addedClasses() {
            return {
                c_selected : this.props.category.id == this.props.selected_id ? true : false,
            };
        }
    }
    ComboCategoryButton.template = 'ComboCategoryButton';

    Registries.Component.add(ComboCategoryButton);

    return ComboCategoryButton;
});
