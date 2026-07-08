from django import forms


class StudentCSVImportForm(forms.Form):
    csv_file = forms.FileField(label='Archivo CSV (columnas: legajo, full_name)')

    def clean_csv_file(self):
        f = self.cleaned_data['csv_file']
        if not f.name.lower().endswith('.csv'):
            raise forms.ValidationError('El archivo debe tener extensión .csv')
        return f
