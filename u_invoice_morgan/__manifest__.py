# -*- coding: utf-8 -*-
{
    'name': "Unoobi | u_invoice_morgan",
    'summary': """
        Invoice modifications""",
    'description': """
        Invoice modifications
    """,
    'author': "Unoobi",
    'category': 'Account',
    'version': '0.1',
    'depends': [
        'base',
        'account',
        'l10n_mx_edi',
        'l10n_mx_reports',
        'account_reports'
    ],
    'data': [
        # Security
        'security/ir_rules.xml',
        # Data
        'data/data.xml',
        # Views
        'views/account_invoice_view.xml',
        'views/res_users_view.xml',
        'views/search_template_view.xml',
        'views/account_payment_view.xml',
    ],
    'qweb': [],
    'installable': True,
}
