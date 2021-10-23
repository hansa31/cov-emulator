from flask import Flask, send_from_directory
from flask_restful import Api, Resource, reqparse, abort

from flask_cors import CORS  # comment this on deployment
import os
import pathlib
import pandas as pd
import numpy as np
import re

app = Flask(__name__, static_url_path='', static_folder='frontend/build')
CORS(app)  # comment this on deployment
api = Api(app)

log_base_dir = pathlib.Path("../../app/src/data/")
selected_people_classes = []


def getMap(name, dir):
    if 'person_class' in name:
        return Loader.getPeopleList(dir)
    if 'location_class' in name:
        return Loader.getLocationList(dir)
    if 'movement_class' in name:
        return Loader.getMovementList(dir)


class Loader:

    @staticmethod
    def getFile(rdir, day, f_type):
        day = int(day)
        f_name = f"{day:05d}" + f_type + ".csv"
        return pd.read_csv(log_base_dir.joinpath(rdir).joinpath(f_name))

    @staticmethod
    def getLocationList(rdir):
        f_name = "locs.txt"
        fh = open(log_base_dir.joinpath(rdir).joinpath(f_name), 'r')
        return fh.read().split('\n')

    @staticmethod
    def getPeopleList(rdir):
        f_name = "people.txt"
        print(log_base_dir.joinpath(rdir).joinpath(f_name))
        fh = open(log_base_dir.joinpath(rdir).joinpath(f_name), 'r')
        return fh.read().split('\n')

    @staticmethod
    def getMovementList(rdir):
        f_name = "movement.txt"
        fh = open(log_base_dir.joinpath(rdir).joinpath(f_name), 'r')
        return fh.read().split('\n')


class LogListHandler(Resource):
    def get(self):
        fols = [os.path.split(x[0])[-1] for x in os.walk(log_base_dir)]
        return {
            'resultStatus': 'SUCCESS',
            'message': ",".join(map(str, fols[1:]))
        }


class PostTextFileHandler(Resource):
    def post(self):
        parser = reqparse.RequestParser()
        parser.add_argument('dir', type=str)
        parser.add_argument('filename', type=str)

        args = parser.parse_args()

        request_dir = args['dir']
        request_fname = args['filename']
        if request_dir:
            filedir = log_base_dir.joinpath(request_dir).joinpath(request_fname)
        else:
            filedir = '-1'
        try:
            status = "Success"
            message = open(filedir, 'r').read()
        except Exception as e:
            status = "Error"
            message = str(e)
            print(e)

        final_ret = {"status": status, "data": message}

        return final_ret


class PostCSVasJSONHandler(Resource):
    def post(self):
        parser = reqparse.RequestParser()
        parser.add_argument('dir', type=str)
        parser.add_argument('d', type=str)
        parser.add_argument('type', type=str)
        parser.add_argument('columns', type=str, default='')

        args = parser.parse_args()
        print(args)
        request_dir = args['dir']
        request_day = args['d']
        request_type = args['type']
        request_cols = args['columns']

        try:
            status = "Success"
            df = Loader.getFile(request_dir, int(request_day), request_type)
            if len(request_cols) > 0:
                df = df[request_cols.split('|')]
            if 'person_class' in df.columns:
                if selected_people_classes:
                    df = df.loc[df.person_class.apply(lambda x: x in selected_people_classes)]
            print(df)
            message = df.to_csv()
        except Exception as e:
            status = "Error"
            message = str(e)
            print(e)
            abort(500)

        final_ret = {"status": status, "data": message}

        return final_ret


class NDaysHandler(Resource):
    def post(self):
        parser = reqparse.RequestParser()
        parser.add_argument('dir', type=str)

        args = parser.parse_args()

        request_dir = args['dir']
        files = [os.path.split(x)[-1] for x in os.listdir(log_base_dir.joinpath(request_dir))]

        days = 0
        for f in files:
            if 'person_info' in f.__str__():
                days += 1
        return {
            'resultStatus': 'SUCCESS',
            'message': ",".join(map(str, [i for i in range(days)]))
        }


class InfectionTreeHandler(Resource):
    def post(self):
        parser = reqparse.RequestParser()
        parser.add_argument('dir', type=str)
        args = parser.parse_args()
        request_dir = args['dir']

        files = [os.path.split(x)[-1] for x in os.listdir(log_base_dir.joinpath(request_dir))]
        person_infos = []
        for f in files:
            if 'person_info' in f:
                person_infos.append(f)
        person_infos.sort()
        ids = []
        parents = []
        infect_time = []
        for pi in person_infos:
            df = Loader.getFile(request_dir, int(re.search("[0-9]{5}", pi).group()), '_person_info')

            # if selected_people_classes:
            #     df = df.loc[df.person_class.apply(lambda x: x in selected_people_classes)]
            if len(ids) == 0:
                ids = df.index
                parents = df['infected_source_id'].values
                infect_time = df['infected_time'].values
            else:
                parents = np.maximum(parents, df['infected_source_id'].values)
                infect_time = np.maximum(infect_time, df['infected_time'].values)

        df = pd.DataFrame({'id': ids, 'parent': parents, 'time': infect_time})
        df = df.set_index('id')
        df = df.loc[df['parent'] != -1]
        df.loc[df.index == df['parent'], 'parent'] = ''
        print("Infection Tree", df)
        return {
            'resultStatus': 'SUCCESS',
            'data': df.to_csv()
        }


class PossibleGroupsHandler(Resource):
    def post(self):
        parser = reqparse.RequestParser()
        parser.add_argument('dir', type=str)
        args = parser.parse_args()
        request_dir = args['dir']
        return {'status': 'SUCCESS',
                'data': ['person',
                         'person_class',
                         'current_location_id',
                         'current_location_class',
                         'current_movement_id',
                         'current_movement_class',
                         'time',
                         'age',
                         ]
                }


class SetPeopleClassesHandler(Resource):
    def post(self):
        global selected_people_classes
        parser = reqparse.RequestParser()
        parser.add_argument('dir', type=str)
        parser.add_argument('classes', type=str)
        args = parser.parse_args()

        request_dir = args['dir']
        request_group = args['classes'].split(',')
        print(args)

        m = Loader.getPeopleList(request_dir)
        selected_people_classes = list(map(str, request_group))
        selected_people_classes = [m.index(v) for v in selected_people_classes]
        return {'status': 'SUCCESS'}


class NContactHandler(Resource):
    def post(self):
        parser = reqparse.RequestParser()
        parser.add_argument('dir', type=str)
        parser.add_argument('group_by', type=str)
        args = parser.parse_args()
        request_dir = args['dir']
        request_group = args['group_by']

        files = [os.path.split(x)[-1] for x in os.listdir(log_base_dir.joinpath(request_dir))]
        day_info = []
        for f in files:
            if re.search("[0-9]{5}.csv", f) is not None:
                day_info.append(f)
        day_info.sort()

        n_con_df = pd.DataFrame({'group': [], 'n_contacts': []}).set_index('group')
        for pi in day_info:
            df = Loader.getFile(request_dir, int(re.search("[0-9]{5}", pi).group()), '')
            request_group_map = df[request_group].unique()
            for idx in request_group_map:
                if idx not in n_con_df.index:
                    n_con_df = n_con_df.append(pd.DataFrame({'group': [idx], 'n_contacts': [0]}).set_index('group'))

            df = df.loc[df['n_contacts'] > 0]
            df['contacts'] = df['contacts'].map(lambda x: map(int, x.split(' ')))
            for idx, row in df[[request_group, 'n_contacts', 'contacts']].iterrows():
                n_con_df.loc[row[request_group], 'n_contacts'] += row['n_contacts']

        m = getMap(request_group, request_dir)
        if m is None:
            m = {i: i for i in n_con_df.index}
        n_con_df.index = [m[i] for i in n_con_df.index]
        n_con_df.index.name = 'group'
        print(n_con_df, m)

        return {'status': 'SUCCESS',
                'n_contacts': n_con_df.to_csv()}


class ContactHandler(Resource):
    def post(self):
        parser = reqparse.RequestParser()
        parser.add_argument('dir', type=str)
        parser.add_argument('group_by', type=str)
        args = parser.parse_args()
        request_dir = args['dir']
        request_group = args['group_by']

        files = [os.path.split(x)[-1] for x in os.listdir(log_base_dir.joinpath(request_dir))]
        day_info = []
        for f in files:
            if re.search("[0-9]{5}.csv", f) is not None:
                day_info.append(f)
        day_info.sort()
        df_p = Loader.getFile(request_dir, 0, '_person_info')
        con_df = pd.DataFrame({'person': df_p['person'], 'contacts': [[] for _ in range(len(df_p))]})
        con_df = con_df.set_index('person')

        for pi in day_info:
            df = Loader.getFile(request_dir, int(re.search("[0-9]{5}", pi).group()), '')
            df = df.loc[df['n_contacts'] > 0]
            df['contacts'] = df['contacts'].map(lambda x: map(int, x.split(' ')))

            for idx, row in df[['person', 'contacts']].iterrows():
                con_df.loc[row['person'], 'contacts'] += row['contacts']
        df_p = df_p.set_index('person')
        def pID2requesetGroupMap(ID):
            if request_group == 'age':
                return df_p.loc[ID, request_group]//10
            return df_p.loc[ID, request_group]
        con_df['request_group'] = con_df.index.map(pID2requesetGroupMap)

        con_df['contacts'] = con_df['contacts'].map(
                lambda x: [pID2requesetGroupMap(i) for i in x])
        gr = con_df.groupby('request_group')
        print(con_df, gr.groups)
        group_names = list(gr.groups.keys())
        gr_df = pd.DataFrame(index=group_names, columns=group_names).fillna(0)
        for g in gr.groups.keys():
            for lis in gr.get_group(g)['contacts']:
                for item in lis:
                    gr_df.loc[g, item] += 1

        m = getMap(request_group, request_dir)
        if m is None:
            m = {i: i for i in gr_df.index}

        gr_df = gr_df.rename(columns={i: m[i] for i in gr_df.index})
        gr_df.index = [m[i] for i in gr_df.index]

        print(gr_df)

        return {'status': 'SUCCESS',
                'contacts': gr_df.to_csv()}


class PeoplePathHandler(Resource):
    def post(self):
        parser = reqparse.RequestParser()
        parser.add_argument('dir', type=str)
        parser.add_argument('day', type=str)
        parser.add_argument('people', type=str)
        args = parser.parse_args()
        print(args)
        request_dir = args['dir']
        request_selectedDay = args['day']
        try:
            request_people = list(map(int, args['people'].split(',')))
            df = Loader.getFile(request_dir, int(request_selectedDay), '')

            df = df[["person", "time", "x", "y"]]
            df = df.loc[df.person.apply(lambda x: x in request_people)]
        except Exception as e:
            return
        print("Person Paths", df)
        return {'status': 'SUCCESS', 'data': df.to_csv()}


class ActualLocationHistHandler(Resource):
    def post(self):
        parser = reqparse.RequestParser()
        parser.add_argument('dir', type=str)
        parser.add_argument('day', type=str)
        parser.add_argument('groupBy', type=str)
        args = parser.parse_args()
        print(args)
        request_dir = args['dir']
        request_selectedDay = args['day']
        request_groupBy = args['groupBy']

        try:
            df = Loader.getFile(request_dir, int(request_selectedDay), '')
        except Exception as e:
            abort(500)
        df = df[[request_groupBy, "time"]]
        df_gr = df.groupby(request_groupBy)

        m = getMap(request_groupBy, request_dir)

        arr = {'group': [], 'timesteps': []}
        for key in df_gr.groups.keys():
            arr['group'].append(key if m is None else m[key])
            arr['timesteps'].append('|'.join([str(e) for e in df_gr.get_group(key)['time'].values % 1440]))

        result = pd.DataFrame(arr)
        print(result)
        return {'status': 'SUCCESS', 'data': result.to_csv()}


class LocationShapes(Resource):
    def post(self):
        parser = reqparse.RequestParser()
        parser.add_argument('dir', type=str)
        parser.add_argument('day', type=str)
        args = parser.parse_args()
        request_dir = args['dir']
        request_day = args['day']

        df = Loader.getFile(request_dir, request_day, "_location_info")
        df = df[['class','x','y','radius','name','id']]

        print(df)
        return {'status': 'SUCCESS',
                'data': df.to_csv()}

@app.route("/", defaults={'path': ''})
def serve(path):
    return send_from_directory(app.static_folder, 'index.html')


api.add_resource(LogListHandler, '/flask/dirs')
api.add_resource(PostTextFileHandler, '/flask/textfile')
api.add_resource(PostCSVasJSONHandler, '/flask/csvfile')
api.add_resource(NDaysHandler, '/flask/n_days')
api.add_resource(InfectionTreeHandler, '/flask/infectiontree')
api.add_resource(SetPeopleClassesHandler, '/flask/setpeopleclasses')

api.add_resource(PossibleGroupsHandler, '/flask/possible_groups')
api.add_resource(NContactHandler, '/flask/n_contacts')
api.add_resource(ContactHandler, '/flask/contacts')

api.add_resource(ActualLocationHistHandler, '/flask/ActualLocationHist')
api.add_resource(PeoplePathHandler, '/flask/peoplepath')
api.add_resource(LocationShapes, '/flask/locationData')
