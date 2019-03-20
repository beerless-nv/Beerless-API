import os
import time
import gc
import argparse
import pandas as pd
from scipy.sparse import csr_matrix
from sklearn.neighbors import NearestNeighbors
from fuzzywuzzy import fuzz
import pickle
import sys

class KnnRecommender:
    def _prep_data(self):
        #Get model, hashmap and data
        #Model
        with open('model.pickle', 'rb') as handle:
            model = pickle.load(handle)

        #Data
        with open('data.pickle', 'rb') as handle:
            data = pickle.load(handle)

        #Tastingprofiles
        with open('beerID.pickle', 'rb') as handle:
            df_tastingprofiles = pickle.load(handle)

        return model, data, df_tastingprofiles


    def _inference(self, model, data, idx, n_recommendations):
        """
        return top n similar beer recommendations based on user's input movie
        Parameters
        ----------
        model: sklearn model, knn model
        data: beer-tastingprofile matrix
        hashmap: dict, map beer name to index of the beer in data
        fav_beer: str, name of user input beer
        n_recommendations: int, top n recommendations
        Return
        ------
        list of top n similar beer recommendations
        """
        #Removing duplicate recommendation
        n_recommendations = n_recommendations +1


        # inference
        #print('Recommendation system start to make inference')
        #print('......\n')
        t0 = time.time()
        distances, indices = model.kneighbors(
            data[idx],
            n_neighbors=n_recommendations+1)

        # get list of raw idx of recommendations
        raw_recommends = \
            sorted(
                list(
                    zip(
                        indices.squeeze().tolist(),
                        distances.squeeze().tolist()
                    )
                ),
                key=lambda x: x[1]
            )[:0:-1]

        #print('It took my system {:.2f}s to make inference \n\
        #     '.format(time.time() - t0))
        # return recommendation (beerID, distance)

        return raw_recommends

    def make_recommendations(self, idx, n_recommendations):
        """
        make top n beer recommendations
        Parameters
        ----------
        fav_beer: str, name of user input beer
        n_recommendations: int, top n recommendations
        """

        # get data
        model, data, df_tastingprofiles = self._prep_data()

        #get index of beerId
        beerindex = int(df_tastingprofiles[df_tastingprofiles['beerId'] == idx].index.values)
        #print('test beerindex vinden')
        #print(beerindex)

        # get recommendations
        raw_recommends = self._inference(
            model, data, beerindex, n_recommendations)

        #print(raw_recommends)

        #Sorting Raw Recommendations
        def sortSecond(val):
            return val[1]

        raw_recommends.sort(key = sortSecond)

        #Remove extra
        #print("test raw_recommends remove")
        for beer in raw_recommends:
            if beer[0] == beerindex:
                raw_recommends.remove(beer)

        #Remove extra if still longer
        if len(raw_recommends) > n_recommendations:
            del raw_recommends[-1]

        #Create object to return
        beerAPI = pd.DataFrame(columns=('beerId','distance'))

        #print('Recommendations for {}:'.format(idx))
        teller = 1
        for beer in raw_recommends:
            beerID = int(df_tastingprofiles.iloc[beer[0]].beerId)
            beerAPI.loc[teller, 'beerId'] =  int(beerID)
            beerAPI.loc[teller, 'distance'] = beer[1]
            teller = teller + 1
        print(beerAPI.to_json(orient='records'))



# get args
beerId = sys.argv[1]
top_n = int(sys.argv[2])
# initial recommender system
recommender = KnnRecommender()
# make recommendations
recommender.make_recommendations(beerId, top_n)
