# -*- coding: utf-8 -*-
{
    'name': "BIRTUM | Fast Invoicing",

    'summary': """
        Invoicing from website""",

    'description': """
        Search and invoice PoS orders from website.
    """,

    'author': "BIRTUM ©",
    
    "website": "www.birtum.com",
    
    'category': 'Website',
    
    'version': '0.1',

    'depends': [
        'analytic',
        'website',
        'sale_management',
        'point_of_sale',
        'l10n_mx_edi'
    ],

    'data': [
        # SECURITY
        'security/ir.model.access.csv',
        'security/fast_invoicing_security.xml',
        # DATA
        'data/website_data.xml',
        #'data/cron_data.xml',
        'data/cfdi.xml',
        'data/payment10.xml',
        # VIEWS
        'views/inherit_res_config_settings_view.xml',
        'views/inherit_orders_views.xml',
        'views/inherit_account_analytic_account_views.xml',
        'views/account_payment_manual_views.xml',
        'views/ir_actions_server.xml',
        'views/account_invoice_view.xml',
        'views/inherit_account_payment_views.xml',
        'views/pos_payment_method_view.xml',
        "views/inherit_view_pos_order_tree.xml",
        # REPORTS
        'report/report_invoice.xml',
        # TEMPLATE
        'views/website_invoicing_templates.xml',
        'views/assets.xml',
    ],
    'qweb': ['static/src/xml/inherit_pos_ticket.xml'],
}
