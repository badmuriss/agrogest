import unittest
from pathlib import Path
from server import extract, fields_from_text, parse_tsv

FIXTURES = Path(__file__).resolve().parents[2] / 'tests' / 'fixtures'

class ExtractionTests(unittest.TestCase):
    def test_literal_quote_never_leaks_tsv_rows_into_recognized_text(self):
        header = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n'
        tsv = header + '5\t1\t1\t1\t1\t1\t10\t10\t10\t10\t80\t"\n5\t1\t1\t1\t2\t1\t10\t20\t50\t10\t95\tTOTAL\n5\t1\t1\t1\t2\t2\t70\t20\t40\t10\t95\t47,00\n'
        words, text = parse_tsv(tsv)
        self.assertEqual([w['text'] for w in words], ['"', 'TOTAL', '47,00'])
        self.assertEqual(text, '"\nTOTAL 47,00')
        self.assertNotIn('\t', text)
        self.assertEqual(fields_from_text(text)['amountCents'], 4700)

    def test_dot_decimal_is_read_but_conflicting_dates_and_tax_values_are_not_guessed(self):
        result = fields_from_text('TOTAL R$ 47.00\nTotal aproximado de tributos: 7,61\n21/09/2016\n21/09/2018')
        self.assertEqual(result['amountCents'], 4700)
        self.assertIsNone(result['occurredAt'])
        self.assertIsNone(result['supplier'])

    def test_real_portuguese_image(self):
        result = extract((FIXTURES / 'comprovante-gs-001.png').read_bytes())
        self.assertEqual(result['fields']['amountCents'], 125040)
        self.assertEqual(result['fields']['supplier'], 'Cooperativa Campo Verde')
        self.assertEqual(result['fields']['occurredAt'], '2026-11-06')
        self.assertGreater(len(result['words']), 15)
        self.assertGreater(result['confidence'], .7)

    def test_other_image_is_not_a_constant_sample(self):
        result = extract((FIXTURES / 'comprovante-gs-002.png').read_bytes())
        self.assertEqual(result['fields']['amountCents'], 8990)
        self.assertEqual(result['fields']['supplier'], 'Oficina Rural')
        self.assertIn('Trator', result['text'])

    def test_missing_fields_stay_missing(self):
        result = fields_from_text('RECIBO\nItem: Frete para fazenda\nSem valor ou data legivel')
        self.assertIsNone(result['amountCents'])
        self.assertIsNone(result['occurredAt'])
        self.assertEqual(result['description'], 'Frete para fazenda')

    def test_conflicting_totals_and_invalid_calendar_are_not_guessed(self):
        result = fields_from_text('Data: 31/02/2026\nTotal: 10,00\nValor final: 12,00')
        self.assertIsNone(result['amountCents'])
        self.assertIsNone(result['occurredAt'])

    def test_corrupted_and_non_image_inputs_fail(self):
        with self.assertRaises(ValueError): extract(b'<html>NAO E IMAGEM</html>')
        with self.assertRaises(ValueError): extract(b'\x89PNG\r\n\x1a\nnot-a-real-image')

if __name__ == '__main__': unittest.main()
