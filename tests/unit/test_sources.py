import unittest
import sgrape_sources as s


class SourceMatching(unittest.TestCase):
    def setUp(self):
        self.decls=[{'id':name,'kind':'uniform','name':'u'+name,'type':'float','value':0} for name in ('A','B')]
        self.registry={d['id']:{'sequence':'vec','index':i,'name':d['name']} for i,d in enumerate(self.decls)}

    def rows(self,*names):
        return [{'sequence':'vec','index':i,'name':name,'nameMode':'CONSTANT','components':[{'value':0}]*4} for i,name in enumerate(names)]

    def test_reorder(self):
        decls,registry,issues=s.reconcile(self.decls,self.registry,self.rows('uB','uA'))
        self.assertEqual(issues,[]);self.assertEqual(decls,self.decls);self.assertEqual(registry['A']['index'],1)

    def test_unique_native_rename(self):
        decls,registry,issues=s.reconcile(self.decls,self.registry,self.rows('uA','uNew'))
        self.assertEqual(issues,[]);self.assertEqual(decls[1]['id'],'B');self.assertEqual(decls[1]['name'],'uNew')

    def test_ambiguous_edits_not_guessed(self):
        decls,registry,issues=s.reconcile(self.decls,self.registry,self.rows('uX','uY'))
        self.assertTrue(decls[0]['sourceMissing']);self.assertTrue(decls[1]['sourceMissing']);self.assertEqual(len(issues),2)
        self.assertEqual(len(decls),4)

    def test_delete_then_restore_same_owner(self):
        decls,registry,issues=s.reconcile(self.decls,self.registry,self.rows('uB'))
        self.assertTrue(decls[0]['sourceMissing']);self.assertNotIn('sourceMissing',decls[1])
        recovered,_,issues=s.reconcile(decls,registry,self.rows('uA','uB'))
        self.assertEqual(issues,[]);self.assertNotIn('sourceMissing',recovered[0]);self.assertEqual(recovered[0]['id'],'A')

    def test_duplicate_native_names(self):
        decls,registry,issues=s.reconcile(self.decls,self.registry,self.rows('uA','uA'))
        self.assertTrue(all(d.get('sourceMissing') for d in decls));self.assertTrue(issues)

    def test_namespace_collision_and_invalid_name(self):
        decls=self.decls+[{'id':'tex','kind':'sampler','name':'uTexture'}]
        after,_,issues=s.reconcile(decls,self.registry,self.rows('uA','uB','uTexture','not legal','gl_Reserved'))
        self.assertEqual(after,decls);self.assertEqual(len(issues),3)

    def test_color_import_has_vec4_metadata(self):
        rows=self.rows('uColor');rows[0]['sequence']='color'
        decls,_,_=s.reconcile([],{},rows)
        self.assertEqual(decls[0]['type'],'vec4');self.assertEqual(decls[0]['value'],[0]*4)

    def test_edit_token_ignores_animated_value_but_not_identity(self):
        row=self.rows('uA')[0];before=s.edit_token(row);row['components']=[{'value':4}]*4
        self.assertEqual(before,s.edit_token(row));row['name']='uOther';self.assertNotEqual(before,s.edit_token(row))


if __name__=='__main__':unittest.main()
